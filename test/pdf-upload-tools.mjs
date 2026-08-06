import assert from 'node:assert/strict';
import { auditUploadedPdf, createPdfUploadSession, deletePdfUpload, finalizePdfUpload } from '../server/pdf-upload-tools.mjs';

const identity = () => ({ ownerId: 'alice', sessionId: 'chat-1' });
const calls = [];
const client = {
  create: async (v) => (calls.push(['create', v]), { upload_id: 'a'.repeat(24), upload_url: 'https://upload.invalid/one-use' }),
  finalize: async (v) => (calls.push(['finalize', v]), { upload_id: v.uploadId, state: 'FINALIZED', byte_sha256: 'b'.repeat(64) }),
  audit: async (v) => (calls.push(['audit', v]), { source: { byte_sha256: 'b'.repeat(64), text_sha256: 'c'.repeat(64) }, pages: [{ page: 1, blocks: [{ block_id: 'p1:b1' }] }] }),
  delete: async (v) => (calls.push(['delete', v]), { deleted: true, verified_absent: true }),
};
assert.equal((await createPdfUploadSession({}, client, identity)).upload_id.length, 24);
assert.equal((await finalizePdfUpload({ upload_id: 'a'.repeat(24) }, client, identity)).state, 'FINALIZED');
let coreCalls = 0;
let result = await auditUploadedPdf({ upload_id: 'a'.repeat(24), audit_request: {} }, client, identity, async () => {
  coreCalls += 1; return { document_bundle_sha256: 'd'.repeat(64) };
});
assert.equal(coreCalls, 1); assert.equal(result.byte_sha256, 'b'.repeat(64));
assert.notEqual(result.byte_sha256, result.derived_hashes.document_bundle_sha256);
const bad = { ...client, audit: async () => ({ source: {}, pages: [] }) };
result = await auditUploadedPdf({ upload_id: 'a'.repeat(24), audit_request: {} }, bad, identity, async () => { coreCalls += 1; });
assert.equal(result.blocking[0], 'PDF_PIPELINE_NOT_VERIFIED'); assert.equal(coreCalls, 1);
assert.equal((await deletePdfUpload({ upload_id: 'a'.repeat(24) }, client, identity)).verified_absent, true);
assert(calls.every(([, value]) => value.ownerId === 'alice' && value.sessionId === 'chat-1'));
assert(!JSON.stringify(calls).includes('%PDF'));
console.log('pdf-upload-tools: PASS');
