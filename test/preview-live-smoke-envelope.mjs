import assert from 'node:assert/strict';
import { callToolStructured, redactDiagnostic, withPdfDelete } from '../scripts/preview-live-smoke-support.mjs';

const bundle = { bundle_version: '0.2.0', source: { byte_sha256: 'a'.repeat(64) }, pages: [] };
assert.deepEqual(await callToolStructured({ callTool: async () => ({ structuredContent: bundle, content: [{ type: 'text', text: '{}' }] }) }, {}), bundle);
await assert.rejects(callToolStructured({ callTool: async () => { throw new Error('transport failed'); } }, {}), /MCP_JSON_RPC_ERROR: transport failed/);
await assert.rejects(callToolStructured({ callTool: async () => ({ isError: true, content: [{ type: 'text', text: 'PIPELINE_TIMEOUT' }] }) }, {}), /MCP_TOOL_ERROR: PIPELINE_TIMEOUT/);
await assert.rejects(callToolStructured({ callTool: async () => ({ content: [{ type: 'text', text: '{}' }] }) }, {}), /MCP_RESULT_ENVELOPE_INVALID/);

for (const response of [
  { structuredContent: bundle },
  { isError: true, content: [{ type: 'text', text: 'AUDIT_FAILED' }] },
  { content: [{ type: 'text', text: '{}' }] },
  new Error('JSON-RPC transport failure'),
]) {
  let deletes = 0;
  const client = { callTool: async ({ name }) => {
    if (name === 'delete_pdf_upload') { deletes += 1; return { structuredContent: { verified_absent: true } }; }
    if (response instanceof Error) throw response;
    return response;
  } };
  const operation = () => callToolStructured(client, { name: 'audit_uploaded_pdf', arguments: {} });
  if (response.structuredContent) await withPdfDelete(client, { upload_id: 'u', delete_capability: 'secret' }, operation);
  else await assert.rejects(withPdfDelete(client, { upload_id: 'u', delete_capability: 'secret' }, operation));
  assert.equal(deletes, 1);
}

const redacted = redactDiagnostic('authorization: secret https://preview.invalid/path#token upload_capability');
assert(!redacted.includes('secret'));
assert(!redacted.includes('#token'));
assert(!redacted.includes('upload_capability'));
console.log('preview-live-smoke-envelope: PASS');
