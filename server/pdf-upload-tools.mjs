import * as z from 'zod/v4';

const uploadId = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const subject = (subjectProvider) => {
  const value = subjectProvider();
  if (!value?.ownerId || !value?.sessionId) throw new Error('Authenticated owner and session are required');
  return value;
};
const toolResult = (structuredContent) => ({ structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] });

export async function createPdfUploadSession(args, client, subjectProvider) {
  return client.create({ ...subject(subjectProvider), requestedMaxBytes: args.max_bytes });
}
export async function finalizePdfUpload(args, client, subjectProvider) {
  return client.finalize({ ...subject(subjectProvider), uploadId: args.upload_id, expectedSha256: args.expected_sha256 });
}
export async function auditUploadedPdf(args, client, subjectProvider, auditPipeline) {
  const identity = subject(subjectProvider);
  const pipelineResult = await client.audit({ ...identity, uploadId: args.upload_id });
  // The pipeline must successfully return byte provenance before any NORMS audit is called.
  if (!pipelineResult?.source?.byte_sha256 || !Array.isArray(pipelineResult.pages)) {
    return { normative_assessment: null, pipeline_result: null, blocking: ['PDF_PIPELINE_NOT_VERIFIED'], limitations: ['NORMS_CORE_NOT_CALLED'] };
  }
  const normativeAssessment = await auditPipeline({ upload_id: args.upload_id, document_bundle: pipelineResult, audit_request: args.audit_request });
  return { pipeline_result: pipelineResult, normative_assessment: normativeAssessment, byte_sha256: pipelineResult.source.byte_sha256,
    derived_hashes: { document_bundle_sha256: normativeAssessment.document_bundle_sha256 ?? null } };
}
export async function deletePdfUpload(args, client, subjectProvider) {
  return client.delete({ ...subject(subjectProvider), uploadId: args.upload_id });
}

export function registerPdfUploadTools(server, { uploadClient, subjectProvider, auditPipeline }) {
  server.registerTool('create_pdf_upload_session', {
    title: 'Create PDF upload session', description: 'Create a short-lived, one-use upload URL. Never place PDF bytes or unbounded base64 in this tool.',
    inputSchema: z.object({ max_bytes: z.number().int().positive().max(20 * 1024 * 1024).optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (args) => toolResult(await createPdfUploadSession(args, uploadClient, subjectProvider)));
  server.registerTool('finalize_pdf_upload', {
    title: 'Finalize PDF upload', description: 'Finalize an uploaded PDF after server-side byte and parser validation.',
    inputSchema: z.object({ upload_id: uploadId, expected_sha256: sha256.optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (args) => toolResult(await finalizePdfUpload(args, uploadClient, subjectProvider)));
  server.registerTool('audit_uploaded_pdf', {
    title: 'Audit uploaded PDF', description: 'Run the verified PDF pipeline, then invoke NORMS audit only after byte provenance is available.',
    inputSchema: z.object({ upload_id: uploadId, audit_request: z.record(z.string(), z.unknown()) }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (args) => toolResult(await auditUploadedPdf(args, uploadClient, subjectProvider, auditPipeline)));
  server.registerTool('delete_pdf_upload', {
    title: 'Delete PDF upload', description: 'Delete upload bytes and verify absence. Repeated deletion is idempotent.',
    inputSchema: z.object({ upload_id: uploadId }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async (args) => toolResult(await deletePdfUpload(args, uploadClient, subjectProvider)));
  return server;
}
