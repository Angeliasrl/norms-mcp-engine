import * as z from 'zod/v4';

const uploadId = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/);
const capability = z.string().min(43).max(256).regex(/^[A-Za-z0-9_-]+$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const toolResult = (structuredContent) => ({ structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] });

function safeAuditToolError(error) {
  const upstream = error?.upstream;
  if (error?.code !== 'PDF_NORMATIVE_PIPELINE_HTTP_ERROR'
      || !upstream
      || !Number.isInteger(upstream.status)
      || upstream.status < 400
      || upstream.status > 599
      || typeof upstream.code !== 'string'
      || !/^[A-Z][A-Z0-9_]{2,127}$/.test(upstream.code)
      || typeof upstream.request_id !== 'string'
      || !/^[A-Za-z0-9:._-]{1,128}$/.test(upstream.request_id)
      || (upstream.message !== undefined
        && (typeof upstream.message !== 'string'
          || upstream.message.length > 256
          || /[\u0000-\u001f\u007f]/.test(upstream.message)))) return null;
  const fields = [
    `status=${upstream.status}`,
    `upstream_code=${upstream.code}`,
    `request_id=${upstream.request_id}`,
  ];
  if (upstream.message !== undefined) fields.push(`upstream_message=${upstream.message}`);
  return { isError: true, content: [{ type: 'text', text: `PDF_NORMATIVE_PIPELINE_HTTP_ERROR ${fields.join(' ')}` }] };
}

export async function createPdfUploadSession(args, client) {
  return client.create({ requestedMaxBytes: args.max_bytes });
}
export async function finalizePdfUpload(args, client) {
  return client.finalize({ uploadId: args.upload_id, capability: args.finalize_capability, expectedSha256: args.expected_sha256 });
}
export async function auditUploadedPdf(args, client, auditPipeline) {
  const pipelineResult = await client.audit({ uploadId: args.upload_id, capability: args.audit_capability });
  if (!pipelineResult?.source?.byte_sha256 || !Array.isArray(pipelineResult.pages)) {
    return { normative_assessment: null, pipeline_result: null, blocking: ['PDF_PIPELINE_NOT_VERIFIED'], limitations: ['NORMS_CORE_NOT_CALLED'] };
  }
  const normativeAssessment = await auditPipeline({ upload_id: args.upload_id, document_bundle: pipelineResult, audit_request: args.audit_request });
  return {
    pipeline_result: pipelineResult,
    normative_assessment: normativeAssessment,
    byte_sha256: pipelineResult.source.byte_sha256,
    derived_hashes: { document_bundle_sha256: normativeAssessment.document_bundle_sha256 ?? null },
  };
}
export async function deletePdfUpload(args, client) {
  return client.delete({ uploadId: args.upload_id, capability: args.delete_capability });
}

export function classifyAttachmentEnvelope(args) {
  const bytesPresent = args.bytes !== undefined && args.bytes !== null;
  const fileIdPresent = typeof args.file_id === 'string' && args.file_id.length > 0;
  const urlPresent = typeof args.url === 'string' && args.url.length > 0;
  const mcpResourcePresent = args.mcp_resource !== undefined && args.mcp_resource !== null;
  const resourceLinkPresent = args.resource_link !== undefined && args.resource_link !== null;
  const textOnly = typeof args.model_text === 'string' && args.model_text.length > 0
    && !bytesPresent && !fileIdPresent && !urlPresent && !mcpResourcePresent && !resourceLinkPresent;
  const referenced = fileIdPresent || urlPresent || mcpResourcePresent || resourceLinkPresent;
  const classification = bytesPresent
    ? 'NATIVE_FILE_HANDOFF_PASS'
    : referenced
      ? 'NATIVE_FILE_REFERENCE_PASS'
      : textOnly
        ? 'MODEL_TEXT_ONLY'
        : Object.keys(args).length === 0
          ? 'NO_FILE_TRANSPORT'
          : 'CLIENT_CAPABILITY_UNKNOWN';
  return {
    classification,
    bytes_present: bytesPresent,
    file_id_present: fileIdPresent,
    url_present: urlPresent,
    mcp_resource_present: mcpResourcePresent,
    resource_link_present: resourceLinkPresent,
    media_type: typeof args.media_type === 'string' ? args.media_type : null,
    declared_size: Number.isSafeInteger(args.declared_size) && args.declared_size >= 0 ? args.declared_size : null,
    retained_content: false,
  };
}

export function registerAttachmentDiagnosticTool(server) {
  server.registerTool('diagnose_native_file_envelope', {
    title: 'Diagnose native file envelope',
    description: 'Preview-only diagnostic. Records presence and metadata shape only; never retains file content.',
    inputSchema: z.object({
      bytes: z.unknown().optional(), file_id: z.string().optional(), url: z.string().optional(),
      mcp_resource: z.unknown().optional(), resource_link: z.unknown().optional(), model_text: z.string().optional(),
      media_type: z.string().optional(), declared_size: z.number().int().nonnegative().optional(),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (args) => toolResult(classifyAttachmentEnvelope(args)));
  return server;
}

export function registerPdfUploadTools(server, { uploadClient, auditPipeline, enableAttachmentProbe = false }) {
  server.registerTool('create_pdf_upload_session', {
    title: 'Create PDF upload session',
    description: 'Create separate short-lived upload, finalize, audit and delete capabilities. No caller identity is inferred.',
    inputSchema: z.object({ max_bytes: z.number().int().positive().max(20 * 1024 * 1024).optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (args) => toolResult(await createPdfUploadSession(args, uploadClient)));
  server.registerTool('finalize_pdf_upload', {
    title: 'Finalize PDF upload', description: 'Consume the scoped finalize capability after server-side validation.',
    inputSchema: z.object({ upload_id: uploadId, finalize_capability: capability, expected_sha256: sha256.optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (args) => toolResult(await finalizePdfUpload(args, uploadClient)));
  server.registerTool('audit_uploaded_pdf', {
    title: 'Audit uploaded PDF', description: 'Consume the scoped audit capability and call NORMS only after byte provenance is verified.',
    inputSchema: z.object({ upload_id: uploadId, audit_capability: capability, audit_request: z.record(z.string(), z.unknown()) }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (args) => {
    try {
      return toolResult(await auditUploadedPdf(args, uploadClient, auditPipeline));
    } catch (error) {
      const safeError = safeAuditToolError(error);
      if (safeError !== null) return safeError;
      throw error;
    }
  });
  server.registerTool('delete_pdf_upload', {
    title: 'Delete PDF upload', description: 'Use the scoped delete capability to delete bytes and revoke remaining capabilities.',
    inputSchema: z.object({ upload_id: uploadId, delete_capability: capability }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async (args) => toolResult(await deletePdfUpload(args, uploadClient)));

  if (enableAttachmentProbe) {
    registerAttachmentDiagnosticTool(server);
  }
  return server;
}
