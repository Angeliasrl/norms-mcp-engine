import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createPdfAuditContainerClient } from '../worker/pdf-upload-http.mjs';
import { PdfUploadBoundaryError } from '../worker/pdf-upload-cloudflare.mjs';

const uploadId = 'a'.repeat(64);
const bytes = new TextEncoder().encode('%PDF-1.4\nfixture\n%%EOF\n');
const byteSha256 = createHash('sha256').update(bytes).digest('hex');
const requestId = `pdf-audit:${uploadId}`;
const envelope = (overrides = {}) => ({
  schema_version: 'norms-pdf-audit/0.5.1',
  request_id: requestId,
  byte_sha256: byteSha256,
  document_bundle: {
    bundle_version: '0.2.0',
    source: { mime_type: 'application/pdf', byte_length: bytes.byteLength, byte_sha256: byteSha256, page_count: 1 },
    pages: [{ page: 1, blocks: [{ block_id: 'p1:b1' }] }],
    unreadable_pages: [], warnings: [],
  },
  ...overrides,
});
const code = async (expected, operation) => assert.rejects(operation, (error) => error instanceof PdfUploadBoundaryError && error.code === expected);
const upstreamError = async (status, body, expectedCode, expectedMessage) => assert.rejects(
  call({ fetch: async () => new Response(body, { status, headers: { 'content-type': 'application/json' } }) }),
  (error) => {
    assert(error instanceof PdfUploadBoundaryError);
    assert.equal(error.code, 'PDF_NORMATIVE_PIPELINE_HTTP_ERROR');
    assert.equal(error.upstream.status, status);
    assert.equal(error.upstream.code, expectedCode);
    assert.equal(error.upstream.request_id, requestId);
    assert.equal(error.upstream.message, expectedMessage);
    assert.match(error.message, new RegExp(`status=${status}`));
    assert(!/secret-capability|Bearer secret|https:\/\/private\.invalid|#fragment/.test(error.message));
    return true;
  },
);
const call = (binding, timeoutMs) => createPdfAuditContainerClient({ binding, timeoutMs }).audit({
  uploadId, bytes, byteSha256, byteLength: bytes.byteLength,
});

let captured;
const positive = await call({ getByName: () => ({ fetch: async (request) => {
  captured = request;
  return Response.json(envelope());
} }) });
assert.equal(positive.source.byte_sha256, byteSha256);
assert.equal(captured.method, 'POST');
assert.equal(new URL(captured.url).pathname, '/pdf-audit');
assert.equal(new URL(captured.url).search, '');
assert.equal(captured.headers.get('content-type'), 'application/pdf');
assert.equal(captured.headers.get('x-norms-pdf-audit-contract'), 'norms-pdf-audit/0.5.1');
assert.equal(captured.headers.get('x-norms-request-id'), requestId);
assert.equal(captured.headers.get('x-content-sha256'), byteSha256);
assert.equal(captured.headers.get('authorization'), null);
assert(![...captured.headers.keys()].some((name) => name.includes('capability')));
assert.deepEqual(new Uint8Array(await captured.arrayBuffer()), bytes);

await code('PDF_NORMATIVE_PIPELINE_NOT_BOUND', call(undefined));
await code('PDF_NORMATIVE_PIPELINE_TIMEOUT', call({ fetch: async () => new Promise(() => {}) }, 5));
for (const status of [400, 404, 413, 422, 500]) {
  await upstreamError(status, JSON.stringify({
    error: { code: `PDF_UPSTREAM_${status}`, message: `Canonical upstream ${status}.` },
    request_id: requestId,
  }), `PDF_UPSTREAM_${status}`, `Canonical upstream ${status}.`);
}
await upstreamError(500, '<html>secret-capability</html>', 'UPSTREAM_ERROR_BODY_UNAVAILABLE', undefined);
await upstreamError(500, 'x'.repeat(4097), 'UPSTREAM_ERROR_BODY_TOO_LARGE', undefined);
await upstreamError(422, JSON.stringify({
  error: {
    code: 'PDF_REDACTION_TEST',
    message: 'Authorization: Bearer secret; capability secret-capability; https://private.invalid/#fragment',
  },
  request_id: requestId,
}), 'PDF_REDACTION_TEST', 'UPSTREAM_MESSAGE_REDACTED');
await upstreamError(422, JSON.stringify({ error: { code: 'PDF_EXTRA_FIELD', message: 'safe', detail: 'forbidden' } }), 'UPSTREAM_ERROR_BODY_UNAVAILABLE', undefined);
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MALFORMED', call({ fetch: async () => new Response('{') }));
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH', call({ fetch: async () => Response.json(envelope({ request_id: 'wrong' })) }));
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH', call({ fetch: async () => Response.json(envelope({ byte_sha256: '0'.repeat(64) })) }));
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH', call({ fetch: async () => Response.json(envelope({ document_bundle: { ...envelope().document_bundle, capability: 'forbidden' } })) }));

console.log('pdf-audit-container-client: PASS');
