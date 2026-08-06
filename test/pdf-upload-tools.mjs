import assert from 'node:assert/strict';
import { auditUploadedPdf, classifyAttachmentEnvelope, createPdfUploadSession, deletePdfUpload, finalizePdfUpload, registerAttachmentDiagnosticTool } from '../server/pdf-upload-tools.mjs';

const caps = { finalize: 'f'.repeat(43), audit: 'a'.repeat(43), delete: 'd'.repeat(43) };
const calls = [];
const client = {
  create: async (v) => (calls.push(['create', v]), { upload_id: 'a'.repeat(24), upload_url: '/pdf-uploads/id#upload_capability=x' }),
  finalize: async (v) => (calls.push(['finalize', v]), { upload_id: v.uploadId, state: 'FINALIZED', byte_sha256: 'b'.repeat(64) }),
  audit: async (v) => (calls.push(['audit', v]), { source: { byte_sha256: 'b'.repeat(64), text_sha256: 'c'.repeat(64) }, pages: [{ page: 1, blocks: [{ block_id: 'p1:b1' }] }] }),
  delete: async (v) => (calls.push(['delete', v]), { deleted: true, verified_absent: true }),
};
assert.equal((await createPdfUploadSession({}, client)).upload_id.length, 24);
assert.equal((await finalizePdfUpload({ upload_id: 'a'.repeat(24), finalize_capability: caps.finalize }, client)).state, 'FINALIZED');
let coreCalls = 0;
let result = await auditUploadedPdf({ upload_id: 'a'.repeat(24), audit_capability: caps.audit, audit_request: {} }, client, async () => {
  coreCalls += 1; return { document_bundle_sha256: 'd'.repeat(64) };
});
assert.equal(coreCalls, 1); assert.equal(result.byte_sha256, 'b'.repeat(64));
assert.notEqual(result.byte_sha256, result.derived_hashes.document_bundle_sha256);
const bad = { ...client, audit: async () => ({ source: {}, pages: [] }) };
result = await auditUploadedPdf({ upload_id: 'a'.repeat(24), audit_capability: caps.audit, audit_request: {} }, bad, async () => { coreCalls += 1; });
assert.equal(result.blocking[0], 'PDF_PIPELINE_NOT_VERIFIED'); assert.equal(coreCalls, 1);
assert.equal((await deletePdfUpload({ upload_id: 'a'.repeat(24), delete_capability: caps.delete }, client)).verified_absent, true);
assert.deepEqual(calls[1][1], { uploadId: 'a'.repeat(24), capability: caps.finalize, expectedSha256: undefined });
assert.deepEqual(calls[2][1], { uploadId: 'a'.repeat(24), capability: caps.audit });
assert.deepEqual(calls[3][1], { uploadId: 'a'.repeat(24), capability: caps.delete });
assert(!JSON.stringify(calls).includes('%PDF'));

assert.equal(classifyAttachmentEnvelope({ bytes: new Uint8Array() }).classification, 'NATIVE_FILE_HANDOFF_PASS');
assert.equal(classifyAttachmentEnvelope({ file_id: 'file-1', media_type: 'application/pdf', declared_size: 10 }).classification, 'NATIVE_FILE_REFERENCE_PASS');
assert.equal(classifyAttachmentEnvelope({ resource_link: { uri: 'mcp://file' } }).classification, 'NATIVE_FILE_REFERENCE_PASS');
assert.equal(classifyAttachmentEnvelope({ model_text: 'extracted' }).classification, 'MODEL_TEXT_ONLY');
assert.equal(classifyAttachmentEnvelope({}).classification, 'NO_FILE_TRANSPORT');
const diagnostic = classifyAttachmentEnvelope({ unexpected: true });
assert.equal(diagnostic.classification, 'CLIENT_CAPABILITY_UNKNOWN');
assert.equal(diagnostic.retained_content, false);
assert(!Object.hasOwn(diagnostic, 'bytes'));
const registered = [];
registerAttachmentDiagnosticTool({ registerTool: (name, schema, handler) => registered.push({ name, schema, handler }) });
assert.equal(registered.length, 1);
assert.equal(registered[0].name, 'diagnose_native_file_envelope');
const probed = await registered[0].handler({ bytes: 'do-not-retain', media_type: 'application/pdf', declared_size: 12 });
assert.equal(probed.structuredContent.retained_content, false);
assert(!JSON.stringify(probed.structuredContent).includes('do-not-retain'));
console.log('pdf-upload-tools: PASS');
