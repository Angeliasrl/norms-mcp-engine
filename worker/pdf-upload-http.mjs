import { createHash } from 'node:crypto';

import { PdfUploadBoundaryError, createPrivateR2UploadAdapter } from './pdf-upload-cloudflare.mjs';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_AUDIT_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_UPSTREAM_ERROR_BYTES = 4 * 1024;
const PDF_AUDIT_CONTRACT = 'norms-pdf-audit/0.5.1';
const PDF_DOCUMENT_BUNDLE_VERSION = '0.2.0';
const DEFAULT_AUDIT_TIMEOUT_MS = 60_000;
const DEFAULT_ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_ATTACHMENT_REDIRECTS = 3;
const PATH = /^\/pdf-uploads\/([A-Za-z0-9_-]{20,128})(?:\/(finalize|audit))?$/;

function validateChatGptDownloadUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PdfUploadBoundaryError('PDF_ATTACHMENT_DOWNLOAD_URL_MISSING', 'Attachment download URL is missing.');
  }
  let url;
  try { url = new URL(value); } catch {
    throw new PdfUploadBoundaryError('PDF_ATTACHMENT_DOWNLOAD_URL_INVALID', 'Attachment download URL is invalid.');
  }
  const hostname = url.hostname.toLowerCase();
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  const privateIpv4 = ipv4 && (() => {
    const octets = ipv4.slice(1).map(Number);
    return octets.some((octet) => octet > 255)
      || octets[0] === 10 || octets[0] === 127 || octets[0] === 0
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168);
  })();
  if (url.protocol !== 'https:' || url.username || url.password
      || (url.port && url.port !== '443') || !hostname.includes('.')
      || hostname === 'localhost' || hostname.endsWith('.localhost')
      || hostname.endsWith('.local') || hostname.endsWith('.internal')
      || hostname.includes(':') || privateIpv4) {
    throw new PdfUploadBoundaryError('PDF_ATTACHMENT_DOWNLOAD_URL_INVALID', 'Attachment download URL is not an allowed public HTTPS URL.');
  }
  return url;
}

function downloadDiagnosticError(code, errorClass, { url, status, redirectCount, startedAt, now, correlationId }) {
  const error = new PdfUploadBoundaryError(code, 'Attachment download failed.');
  error.download = Object.freeze({
    error_class: errorClass,
    ...(url ? { hostname: url.hostname.toLowerCase() } : {}),
    ...(status === undefined ? {} : { status }),
    redirect_count: redirectCount,
    duration_ms: Math.max(0, Math.round(now() - startedAt)),
    correlation_id: correlationId,
  });
  return error;
}

async function boundedPdfBytes(response) {
  const declaredHeader = response.headers.get('content-length');
  const declared = declaredHeader === null ? 0 : Number(declaredHeader);
  if (declaredHeader !== null && (!Number.isSafeInteger(declared) || declared < 1 || declared > MAX_PDF_BYTES)) {
    throw new PdfUploadBoundaryError('PDF_TOO_LARGE', 'Attachment length is absent or outside the configured limit.');
  }
  if (!response.body) throw new PdfUploadBoundaryError('PDF_ATTACHMENT_DOWNLOAD_FAILED', 'Attachment response is missing.');
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PDF_BYTES) {
      await reader.cancel();
      throw new PdfUploadBoundaryError('PDF_TOO_LARGE', 'Attachment exceeds the configured limit.');
    }
    chunks.push(value);
  }
  if (total < 5) throw new PdfUploadBoundaryError('PDF_MAGIC_INVALID', 'Attachment is not a PDF.');
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new PdfUploadBoundaryError('PDF_MAGIC_INVALID', 'Attachment is not a PDF.');
  }
  return bytes;
}

export function createChatGptFileDownloader({
  fetchImpl = fetch,
  timeoutMs = DEFAULT_ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
  now = Date.now,
  correlationId = () => crypto.randomUUID(),
} = {}) {
  return async (file) => {
    if (!file || typeof file.file_id !== 'string' || file.file_id.length < 1 || file.file_id.length > 256
        || /[\u0000-\u001f\u007f]/.test(file.file_id)
        || (file.mime_type !== undefined && file.mime_type !== 'application/pdf')) {
      throw new PdfUploadBoundaryError('PDF_ATTACHMENT_DESCRIPTOR_INVALID', 'Attachment descriptor is invalid.');
    }
    const startedAt = now();
    const requestCorrelationId = correlationId();
    let redirectCount = 0;
    let url;
    try {
      url = validateChatGptDownloadUrl(file.download_url);
    } catch (error) {
      if (error?.code === 'PDF_ATTACHMENT_DOWNLOAD_URL_MISSING') throw error;
      throw downloadDiagnosticError('PDF_ATTACHMENT_DOWNLOAD_URL_INVALID', 'URL_INVALID', {
        redirectCount, startedAt, now, correlationId: requestCorrelationId,
      });
    }
    const controller = new AbortController();
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(downloadDiagnosticError('PDF_ATTACHMENT_DOWNLOAD_TIMEOUT', 'TIMEOUT', {
          url, redirectCount, startedAt, now, correlationId: requestCorrelationId,
        }));
      }, timeoutMs);
    });
    try {
      while (true) {
        let response;
        try {
          response = await Promise.race([fetchImpl(url, {
            method: 'GET', redirect: 'manual', headers: { accept: 'application/pdf' }, signal: controller.signal,
          }), timeout]);
        } catch (error) {
          if (error?.code === 'PDF_ATTACHMENT_DOWNLOAD_TIMEOUT') throw error;
          throw downloadDiagnosticError('PDF_ATTACHMENT_DOWNLOAD_NETWORK_ERROR', 'NETWORK', {
            url, redirectCount, startedAt, now, correlationId: requestCorrelationId,
          });
        }
        if (!(response instanceof Response)) {
          throw downloadDiagnosticError('PDF_ATTACHMENT_DOWNLOAD_NETWORK_ERROR', 'RESPONSE_INVALID', {
            url, redirectCount, startedAt, now, correlationId: requestCorrelationId,
          });
        }
        if (response.status >= 300 && response.status <= 399) {
          if (redirectCount >= MAX_ATTACHMENT_REDIRECTS) {
            throw downloadDiagnosticError('PDF_ATTACHMENT_DOWNLOAD_REDIRECT_LIMIT', 'REDIRECT_LIMIT', {
              url, status: response.status, redirectCount, startedAt, now, correlationId: requestCorrelationId,
            });
          }
          const location = response.headers.get('location');
          let next;
          try {
            if (!location) throw new Error('missing location');
            next = validateChatGptDownloadUrl(new URL(location, url).href);
          } catch {
            throw downloadDiagnosticError('PDF_ATTACHMENT_DOWNLOAD_REDIRECT_REJECTED', 'REDIRECT_REJECTED', {
              url, status: response.status, redirectCount, startedAt, now, correlationId: requestCorrelationId,
            });
          }
          url = next;
          redirectCount += 1;
          continue;
        }
        if (!response.ok) {
          throw downloadDiagnosticError('PDF_ATTACHMENT_DOWNLOAD_HTTP_ERROR', 'HTTP_STATUS', {
            url, status: response.status, redirectCount, startedAt, now, correlationId: requestCorrelationId,
          });
        }
        const mediaType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
        if (mediaType && mediaType !== 'application/pdf' && mediaType !== 'application/octet-stream') {
          throw new PdfUploadBoundaryError('PDF_ATTACHMENT_MEDIA_TYPE_INVALID', 'Attachment response is not a PDF media type.');
        }
        const bytes = await Promise.race([boundedPdfBytes(response), timeout]);
        return {
          bytes,
          byte_sha256: createHash('sha256').update(bytes).digest('hex'),
          byte_length: bytes.byteLength,
          diagnostics: Object.freeze({
            hostname: url.hostname.toLowerCase(), redirect_count: redirectCount,
            duration_ms: Math.max(0, Math.round(now() - startedAt)), correlation_id: requestCorrelationId,
          }),
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

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

async function boundedErrorJson(result) {
  const unavailable = (code = 'UPSTREAM_ERROR_BODY_UNAVAILABLE') => ({ code });
  const declaredHeader = result.headers.get('content-length');
  const declared = declaredHeader === null ? 0 : Number(declaredHeader);
  if ((declaredHeader !== null && (!Number.isSafeInteger(declared) || declared < 0))
      || declared > MAX_UPSTREAM_ERROR_BYTES) return unavailable('UPSTREAM_ERROR_BODY_TOO_LARGE');
  if (!result.body) return unavailable();
  const reader = result.body.getReader(); const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_UPSTREAM_ERROR_BYTES) {
      await reader.cancel();
      return unavailable('UPSTREAM_ERROR_BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return unavailable(); }
  const topKeys = Object.keys(parsed ?? {}).sort();
  const errorKeys = Object.keys(parsed?.error ?? {}).sort();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || ![['error'], ['error', 'request_id']].some((keys) => keys.join('\0') === topKeys.join('\0'))
      || ![['code'], ['code', 'message']].some((keys) => keys.join('\0') === errorKeys.join('\0'))
      || typeof parsed.error.code !== 'string'
      || !/^[A-Z][A-Z0-9_]{2,127}$/.test(parsed.error.code)
      || (parsed.request_id !== undefined
        && (typeof parsed.request_id !== 'string' || !/^[A-Za-z0-9:._-]{1,128}$/.test(parsed.request_id)))
      || (parsed.error.message !== undefined
        && (typeof parsed.error.message !== 'string'
          || parsed.error.message.length > 256
          || /[\u0000-\u001f\u007f]/.test(parsed.error.message)))) return unavailable();
  const unsafeMessage = parsed.error.message !== undefined
    && /(authorization|bearer|capability|https?:\/\/|#)/i.test(parsed.error.message);
  return {
    code: parsed.error.code,
    ...(parsed.request_id === undefined ? {} : { requestId: parsed.request_id }),
    ...(parsed.error.message === undefined ? {} : {
      message: unsafeMessage ? 'UPSTREAM_MESSAGE_REDACTED' : parsed.error.message,
    }),
  };
}

function upstreamHttpError(status, details, requestId) {
  const safeRequestId = details.requestId ?? requestId;
  const fields = [
    `status=${status}`,
    `upstream_code=${details.code}`,
    `request_id=${safeRequestId}`,
  ];
  if (details.message !== undefined) fields.push(`upstream_message=${details.message}`);
  const error = new PdfUploadBoundaryError(
    'PDF_NORMATIVE_PIPELINE_HTTP_ERROR',
    `Normative pipeline rejected the PDF audit request. ${fields.join(' ')}`,
  );
  error.upstream = Object.freeze({ status, code: details.code, request_id: safeRequestId, message: details.message });
  return error;
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
      if (!(result instanceof Response)) {
        throw new PdfUploadBoundaryError('PDF_NORMATIVE_PIPELINE_HTTP_ERROR', 'Normative pipeline returned no HTTP response.');
      }
      if (!result.ok) throw upstreamHttpError(result.status, await boundedErrorJson(result), requestId);
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
    async upload({ uploadId, capability: supplied, bytes }) {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > MAX_PDF_BYTES) {
        throw new PdfUploadBoundaryError('PDF_TOO_LARGE', 'Attachment bytes are outside the configured limit.');
      }
      const uploaded = await adapter.put({ uploadId, capability: supplied, body: bytes, declaredLength: bytes.byteLength });
      const byteSha256 = createHash('sha256').update(bytes).digest('hex');
      await adapter.recordInspection({ uploadId, byteSha256, r2Version: uploaded.r2_version, r2Etag: uploaded.r2_etag });
      return { upload_id: uploadId, state: 'UPLOADED', byte_sha256: byteSha256, byte_length: bytes.byteLength };
    },
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
