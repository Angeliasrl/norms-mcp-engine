import assert from 'node:assert/strict';
import { auditPdfAttachment, auditUploadedPdf, classifyAttachmentEnvelope, createPdfUploadSession, deletePdfUpload, finalizePdfUpload, registerAttachmentDiagnosticTool, registerPdfUploadTools } from '../server/pdf-upload-tools.mjs';

const caps = { finalize: 'f'.repeat(43), audit: 'a'.repeat(43), delete: 'd'.repeat(43) };
const cleanupEvidence = {
  claim: 'SPECIFIC_UPLOADED_OBJECT_ABSENT', scope: { object: 'SINGLE_OPAQUE_UPLOAD_OBJECT', session: 'SINGLE_UPLOAD_SESSION' },
  checked_at: '2026-08-07T00:00:00.000Z', method: 'R2_HEAD_AFTER_DELETE',
  storage_source: { liveness: 'LIVE', outcome: 'ABSENT' }, proof: { type: 'DIRECT_STORAGE_METADATA_LOOKUP', result: 'ABSENT' },
  blockers: [], limits: ['Does not prove absence from backups, logs, or external systems.'],
};
const calls = [];
const client = {
  create: async (v) => (calls.push(['create', v]), {
    upload_id: 'a'.repeat(24), upload_url: `/pdf-uploads/id#upload_capability=${'u'.repeat(43)}`,
    finalize_capability: caps.finalize, audit_capability: caps.audit, delete_capability: caps.delete,
  }),
  upload: async (v) => (calls.push(['upload', { ...v, bytes: `[${v.bytes.byteLength} bytes]` }]), { upload_id: v.uploadId, state: 'UPLOADED', byte_sha256: 'b'.repeat(64), byte_length: v.bytes.byteLength }),
  finalize: async (v) => (calls.push(['finalize', v]), { upload_id: v.uploadId, state: 'FINALIZED', byte_sha256: 'b'.repeat(64) }),
  audit: async (v) => (calls.push(['audit', v]), { source: { byte_sha256: 'b'.repeat(64), text_sha256: 'c'.repeat(64) }, pages: [{ page: 1, blocks: [{ block_id: 'p1:b1' }] }] }),
  delete: async (v) => (calls.push(['delete', v]), { deleted: true, verified_absent: true, cleanup_evidence: cleanupEvidence }),
};
assert.equal((await createPdfUploadSession({}, client)).upload_id.length, 24);
assert.equal((await finalizePdfUpload({ upload_id: 'a'.repeat(24), finalize_capability: caps.finalize }, client)).state, 'FINALIZED');
let coreCalls = 0;
let result = await auditUploadedPdf({ upload_id: 'a'.repeat(24), audit_capability: caps.audit, audit_request: {} }, client, async () => {
  coreCalls += 1; return { normative_assessment: null, audit_request_sha256: 'd'.repeat(64), norms_output_sha256: null, blocking: [], limitations: ['NORMS_CORE_NOT_CALLED'] };
});
assert.equal(coreCalls, 1); assert.equal(result.byte_sha256, 'b'.repeat(64));
assert.equal(result.pipeline_result.bundle_version, '0.2.1');
assert.notEqual(result.byte_sha256, result.derived_hashes.document_bundle_sha256);
const bad = { ...client, audit: async () => ({ source: {}, pages: [] }) };
result = await auditUploadedPdf({ upload_id: 'a'.repeat(24), audit_capability: caps.audit, audit_request: {} }, bad, async () => { coreCalls += 1; });
assert.equal(result.blocking[0], 'PDF_PIPELINE_NOT_VERIFIED'); assert.equal(coreCalls, 1);
assert.equal((await deletePdfUpload({ upload_id: 'a'.repeat(24), delete_capability: caps.delete }, client)).verified_absent, true);
assert.deepEqual(calls[1][1], { uploadId: 'a'.repeat(24), capability: caps.finalize, expectedSha256: undefined });
assert.deepEqual(calls[2][1], { uploadId: 'a'.repeat(24), capability: caps.audit });
assert.deepEqual(calls[3][1], { uploadId: 'a'.repeat(24), capability: caps.delete });
assert(!JSON.stringify(calls).includes('%PDF'));

const attachmentResult = await auditPdfAttachment({ file: {
  download_url: 'https://files.example.test/download', file_id: 'file-safe', mime_type: 'application/pdf', file_name: 'fixture.pdf',
}, audit_request: {} }, client, async () => ({ normative_assessment: null, audit_request_sha256: 'd'.repeat(64), norms_output_sha256: null, blocking: [], limitations: ['NORMS_CORE_NOT_CALLED'] }), async () => ({
  bytes: new TextEncoder().encode('%PDF-fixture'), byte_sha256: 'b'.repeat(64), byte_length: 12,
  diagnostics: { hostname: 'files.example.test', redirect_count: 1, duration_ms: 12, correlation_id: '11111111-1111-4111-8111-111111111111' },
}));
assert.deepEqual(attachmentResult.lifecycle, { create: 'PASS', upload: 'PASS', finalize: 'PASS', audit: 'PASS', delete: 'PASS', verified_absent: true });
assert.equal(attachmentResult.pipeline_result.bundle_version, '0.2.1');
assert.deepEqual(attachmentResult.pipeline_result.cleanup, cleanupEvidence);
assert.equal(attachmentResult.attachment.byte_sha256, 'b'.repeat(64));
assert.equal(attachmentResult.attachment.byte_length, 12);
assert.equal(attachmentResult.download.hostname, 'files.example.test');
assert(!JSON.stringify(attachmentResult).includes('capability'));
assert(!JSON.stringify(attachmentResult).includes('file-safe'));
assert.equal(calls.at(-1)[0], 'delete');

const unknownCleanup = structuredClone(cleanupEvidence);
unknownCleanup.storage_source = { liveness: 'UNAVAILABLE', outcome: 'UNKNOWN' };
unknownCleanup.proof.result = 'UNKNOWN';
unknownCleanup.blockers = ['PDF_DELETE_STORAGE_VERIFICATION_UNAVAILABLE'];
const unknownResult = await auditPdfAttachment({ file: {
  download_url: 'https://files.example.test/download', file_id: 'file-safe', mime_type: 'application/pdf',
}, audit_request: {} }, { ...client, delete: async () => ({ deleted: true, verified_absent: null, cleanup_evidence: unknownCleanup }) },
async () => ({ normative_assessment: null, audit_request_sha256: 'd'.repeat(64), norms_output_sha256: null, blocking: [], limitations: ['NORMS_CORE_NOT_CALLED'] }),
async () => ({ bytes: new TextEncoder().encode('%PDF-fixture'), byte_sha256: 'b'.repeat(64), byte_length: 12 }));
assert.equal(unknownResult.lifecycle.delete, 'PASS');
assert.equal(unknownResult.lifecycle.verified_absent, null);
assert(unknownResult.blocking.includes('PDF_DELETE_STORAGE_VERIFICATION_UNAVAILABLE'));

let cleanupCalled = false;
await assert.rejects(auditPdfAttachment({ file: {
  download_url: 'https://files.example.test/download', file_id: 'file-safe', mime_type: 'application/pdf',
} }, { ...client, upload: async () => { throw Object.assign(new Error('upload rejected'), { code: 'PDF_UPLOAD_FAILED' }); }, delete: async () => { cleanupCalled = true; return { deleted: true, verified_absent: true }; } },
async () => assert.fail('audit must not run'), async () => ({ bytes: new TextEncoder().encode('%PDF-fixture'), byte_sha256: 'b'.repeat(64), byte_length: 12 })),
(error) => error.code === 'PDF_UPLOAD_FAILED');
assert.equal(cleanupCalled, true);

const toolRegistrations = new Map();
registerPdfUploadTools({ registerTool: (name, schema, handler) => toolRegistrations.set(name, { schema, handler }) }, {
  uploadClient: {
    ...client,
    audit: async () => {
      const error = new Error('must not cross the MCP boundary');
      error.code = 'PDF_NORMATIVE_PIPELINE_HTTP_ERROR';
      error.upstream = Object.freeze({ status: 422, code: 'PDF_MAGIC_INVALID', request_id: 'pdf-audit:request-safe', message: 'PDF magic is invalid.' });
      throw error;
    },
  },
  auditPipeline: async () => assert.fail('audit pipeline must not run'),
  fileDownloader: async () => assert.fail('file downloader must not run'),
});
assert.deepEqual(toolRegistrations.get('audit_pdf_attachment').schema._meta, { 'openai/fileParams': ['file'] });
const surfaced = await toolRegistrations.get('audit_uploaded_pdf').handler({
  upload_id: 'a'.repeat(24), audit_capability: caps.audit, audit_request: {},
});
assert.equal(surfaced.isError, true);
assert.equal(surfaced.content[0].text, 'PDF_NORMATIVE_PIPELINE_HTTP_ERROR status=422 upstream_code=PDF_MAGIC_INVALID request_id=pdf-audit:request-safe upstream_message=PDF magic is invalid.');
assert(!surfaced.content[0].text.includes('must not cross'));

const safeRegistrations = new Map();
registerPdfUploadTools({ registerTool: (name, schema, handler) => safeRegistrations.set(name, { schema, handler }) }, {
  uploadClient: client, auditPipeline: async () => assert.fail('audit pipeline must not run'),
  fileDownloader: async () => {
    const error = Object.assign(new Error('Authorization Capability secret fragment'), { code: 'PDF_ATTACHMENT_DOWNLOAD_HTTP_ERROR' });
    error.download = { error_class: 'HTTP_STATUS', hostname: 'files.example.test', status: 403, redirect_count: 1, duration_ms: 25, correlation_id: '11111111-1111-4111-8111-111111111111' };
    throw error;
  },
});
const safeAttachmentError = await safeRegistrations.get('audit_pdf_attachment').handler({
  file: { download_url: 'https://files.example.test/download', file_id: 'file-safe' }, audit_request: {},
});
assert.deepEqual(safeAttachmentError, { isError: true, content: [{ type: 'text', text: 'PDF_ATTACHMENT_DOWNLOAD_HTTP_ERROR error_class=HTTP_STATUS hostname=files.example.test status=403 redirects=1 duration_ms=25 correlation_id=11111111-1111-4111-8111-111111111111' }] });
assert(!JSON.stringify(safeAttachmentError).includes('Authorization'));

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
