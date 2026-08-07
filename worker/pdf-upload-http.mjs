import { createHash } from 'node:crypto';

import { PdfUploadBoundaryError, createPrivateR2UploadAdapter } from './pdf-upload-cloudflare.mjs';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_AUDIT_RESPONSE_BYTES = 32 * 1024 * 1024;
const PDF_AUDIT_CONTRACT = 'norms-pdf-audit/0.5.1';
const PDF_DOCUMENT_BUNDLE_VERSION = '0.2.0';
const DEFAULT_AUDIT_TIMEOUT_MS = 60_000;
const PATH = /^\/pdf-uploads\/([A-Za-z0-9_-]{20,128})(?:\/(finalize|audit))?$/;

function requireRuntime(env) {
  if (!env?.PDF_UPLOADS || !env?.PDF_UPLOAD_COORDINATOR) {
    throw new PdfUploadBoundaryError('UPLOAD_BINDING_MISSING', 'Private upload bindings are required.');
  }
  if (typeof env.PDF_UPLOAD_CAPABILITY_HMAC_KEY !== 'string'
      || Buffer.byteLength(env.PDF_UPLOAD_CAPABILITY_HMAC_KEY) < 32) {
    throw new PdfUploadBoundaryError('CAPABILITY_KEY_NOT_CONFIGURED', 'A server-side capability key is required.');
  }
  return createPrivateR2UploadAdapter({
    bucket: env.PDF_UPLOADS,
    namespace: env.PDF_UPLOAD_COORDINATOR,
  });
}

function capability(request) {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Capability ') ? header.slice('Capability '.length) : '';
}

const response = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
});

function boundaryResponse(error) {
  const code = error instanceof PdfUploadBoundaryError ? error.code : 'UPLOAD_INTERNAL_ERROR';
  const status = {
    CAPABILITY_KEY_NOT_CONFIGURED: 503,
    UPLOAD_BINDING_MISSING: 503,
    CAPABILITY_INVALID: 401,
    CAPABILITY_QUERY_REJECTED: 400,
    CAPABILITY_EXPIRED: 408,
    PDF_TOO_LARGE: 413,
    STATE_TRANSITION_REJECTED: 409,
    CAPABILITY_REPLAYED: 409,
    PDF_NORMATIVE_PIPELINE_NOT_BOUND: 503,
    PDF_NORMATIVE_PIPELINE_TIMEOUT: 504,
    PDF_NORMATIVE_PIPELINE_HTTP_ERROR: 502,
    PDF_NORMATIVE_PIPELINE_RESPONSE_TOO_LARGE: 502,
    PDF_NORMATIVE_PIPELINE_RESPONSE_MALFORMED: 502,
    PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH: 502,
  }[code] ?? 422;
  return response({ error: { code } }, status);
}

async function boundedJson(result) {
  const declared = Number(result.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_AUDIT_RESPONSE_BYTES) {
    throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_RESPONSE_TOO_LARGE', 'Normative pipeline response exceeds the limit.');
  }
  if (!result.body) throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_RESPONSE_MALFORMED', 'Normative pipeline response is missing.');
  const reader = result.body.getReader(); const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_AUDIT_RESPONSE_BYTES) {
      await reader.cancel();
      throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_RESPONSE_TOO_LARGE', 'Normative pipeline response exceeds the limit.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch {
    throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_RESPONSE_MALFORMED', 'Normative pipeline returned invalid JSON.');
  }
}

function containsForbiddenBoundaryField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => /capability|authorization/i.test(key)
    || containsForbiddenBoundaryField(child));
}

function validateAuditEnvelope(envelope, { requestId, byteSha256, byteLength }) {
  const exactKeys = ['byte_sha256', 'document_bundle', 'request_id', 'schema_version'];
  const source = envelope?.document_bundle?.source;
  const pages = envelope?.document_bundle?.pages;
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
      || Object.keys(envelope).sort().join('\0') !== exactKeys.join('\0')
      || envelope.schema_version !== PDF_AUDIT_CONTRACT
      || envelope.request_id !== requestId
      || envelope.byte_sha256 !== byteSha256
      || envelope.document_bundle?.bundle_version !== PDF_DOCUMENT_BUNDLE_VERSION
      || source?.byte_sha256 !== byteSha256
      || source?.byte_length !== byteLength
      || source?.mime_type !== 'application/pdf'
      || !Number.isSafeInteger(source?.page_count)
      || !Array.isArray(pages)
      || source.page_count !== pages.length
      || !Array.isArray(envelope.document_bundle.unreadable_pages)
      || !Array.isArray(envelope.document_bundle.warnings)
      || containsForbiddenBoundaryField(envelope)) {
    throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH', 'Normative pipeline response does not match the upload session.');
  }
  return envelope.document_bundle;
}

export function createPdfAuditContainerClient({ binding, timeoutMs = DEFAULT_AUDIT_TIMEOUT_MS } = {}) {
  return {
    async audit({ uploadId, bytes, byteSha256, byteLength }) {
      if (!binding) throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_NOT_BOUND', 'Normative pipeline binding is unavailable.');
      const target = typeof binding.getByName === 'function' ? binding.getByName('norms-resolver-v1') : binding;
      if (typeof target?.fetch !== 'function') throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_NOT_BOUND', 'Normative pipeline binding is unavailable.');
      const requestId = `pdf-audit:${uploadId}`;
      const controller = new AbortController();
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_TIMEOUT', 'Normative pipeline timed out.'));
        }, timeoutMs);
      });
      let result;
      try {
        const request = new Request('http://resolver.internal/pdf-audit', {
          method: 'POST',
          headers: {
            'content-type': 'application/pdf',
            'x-norms-pdf-audit-contract': PDF_AUDIT_CONTRACT,
            'x-norms-request-id': requestId,
            'x-content-sha256': byteSha256,
          },
          body: bytes,
          signal: controller.signal,
        });
        result = await Promise.race([target.fetch(request), timeout]);
      } catch (error) {
        if (error instanceof PdfUploadBoundaryError) throw error;
        throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_HTTP_ERROR', 'Normative pipeline request failed.');
      } finally { clearTimeout(timeoutId); }
      if (!(result instanceof Response) || !result.ok) {
        throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_HTTP_ERROR', 'Normative pipeline rejected the PDF audit request.');
      }
      return validateAuditEnvelope(await boundedJson(result), { requestId, byteSha256, byteLength });
    },
  };
}

async function auditWithPipeline(adapter, env, args) {
  const verified = await adapter.readForAudit(args);
  try {
    const documentBundle = await createPdfAuditContainerClient({ binding: env.NORMS_RESOLVER }).audit({
      uploadId: args.uploadId,
      bytes: verified.bytes,
      byteSha256: verified.byte_sha256,
      byteLength: verified.byte_length,
    });
    await adapter.completeAudit({ uploadId: args.uploadId });
    return documentBundle;
  } catch (error) {
    await adapter.fail({ uploadId: args.uploadId, code: error?.code ?? 'PDF_NORMATIVE_PIPELINE_FAILED' });
    throw error;
  }
}

export function pdfUploadClientFromEnv(env) {
  const adapter = requireRuntime(env);
  return {
    create: (args) => adapter.create(args),
    finalize: (args) => adapter.finalize(args),
    audit: (args) => auditWithPipeline(adapter, env, args),
    delete: (args) => adapter.delete(args),
  };
}

export async function handlePdfUploadRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/pdf-uploads/')) return null;
  try {
    if (url.search.length > 0) {
      throw new PdfUploadBoundaryError('CAPABILITY_QUERY_REJECTED', 'Capabilities are forbidden in query parameters.');
    }
    const match = PATH.exec(url.pathname);
    if (!match) return response({ error: { code: 'UPLOAD_ROUTE_NOT_FOUND' } }, 404);
    const [, uploadId, action] = match;
    const adapter = requireRuntime(env);
    const supplied = capability(request);
    if (request.method === 'PUT' && action === undefined) {
      const declaredLength = Number(request.headers.get('content-length'));
      if (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > MAX_PDF_BYTES) {
        throw new PdfUploadBoundaryError('PDF_TOO_LARGE', 'Declared length is outside the configured limit.');
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength !== declaredLength) throw new PdfUploadBoundaryError('R2_LENGTH_DIVERGED', 'Uploaded length diverged.');
      const uploaded = await adapter.put({ uploadId, capability: supplied, body: bytes, declaredLength });
      const byteSha256 = createHash('sha256').update(bytes).digest('hex');
      await adapter.recordInspection({
        uploadId,
        byteSha256,
        r2Version: uploaded.r2_version,
        r2Etag: uploaded.r2_etag,
      });
      return response({ upload_id: uploadId, state: 'UPLOADED', byte_sha256: byteSha256 });
    }
    if (request.method === 'POST' && action === 'finalize') {
      const body = await request.json().catch(() => ({}));
      return response(await adapter.finalize({ uploadId, capability: supplied, expectedSha256: body.expected_sha256 }));
    }
    if (request.method === 'POST' && action === 'audit') {
      const documentBundle = await auditWithPipeline(adapter, env, { uploadId, capability: supplied });
      return response({ upload_id: uploadId, state: 'CONSUMED', byte_sha256: documentBundle.source.byte_sha256, document_bundle: documentBundle });
    }
    if (request.method === 'DELETE' && action === undefined) {
      return response(await adapter.delete({ uploadId, capability: supplied }));
    }
    return response({ error: { code: 'UPLOAD_METHOD_NOT_ALLOWED' } }, 405);
  } catch (error) {
    return boundaryResponse(error);
  }
}
