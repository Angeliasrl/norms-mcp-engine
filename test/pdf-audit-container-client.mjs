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
await code('PDF_NORMATIVE_PIPELINE_HTTP_ERROR', call({ fetch: async () => new Response('', { status: 404 }) }));
await code('PDF_NORMATIVE_PIPELINE_HTTP_ERROR', call({ fetch: async () => new Response('', { status: 500 }) }));
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MALFORMED', call({ fetch: async () => new Response('{') }));
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH', call({ fetch: async () => Response.json(envelope({ request_id: 'wrong' })) }));
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH', call({ fetch: async () => Response.json(envelope({ byte_sha256: '0'.repeat(64) })) }));
await code('PDF_NORMATIVE_PIPELINE_RESPONSE_MISMATCH', call({ fetch: async () => Response.json(envelope({ document_bundle: { ...envelope().document_bundle, capability: 'forbidden' } })) }));

console.log('pdf-audit-container-client: PASS');
