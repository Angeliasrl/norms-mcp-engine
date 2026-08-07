import { createHash } from 'node:crypto';

import { PdfUploadBoundaryError, createPrivateR2UploadAdapter } from './pdf-upload-cloudflare.mjs';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
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
  }[code] ?? 422;
  return response({ error: { code } }, status);
}

export function pdfUploadClientFromEnv(env) {
  const adapter = requireRuntime(env);
  return {
    create: (args) => adapter.create(args),
    finalize: (args) => adapter.finalize(args),
    audit: async (args) => {
      const verified = await adapter.verifyForAudit(args);
      await adapter.completeAudit({ uploadId: args.uploadId });
      return { source: { byte_sha256: verified.byte_sha256 }, pages: [] };
    },
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
      const verified = await adapter.verifyForAudit({ uploadId, capability: supplied });
      const completed = await adapter.completeAudit({ uploadId });
      return response({ upload_id: uploadId, state: completed.state, byte_sha256: verified.byte_sha256 });
    }
    if (request.method === 'DELETE' && action === undefined) {
      return response(await adapter.delete({ uploadId, capability: supplied }));
    }
    return response({ error: { code: 'UPLOAD_METHOD_NOT_ALLOWED' } }, 405);
  } catch (error) {
    return boundaryResponse(error);
  }
}
