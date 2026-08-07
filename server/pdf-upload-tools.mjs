import * as z from 'zod/v4';

const uploadId = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/);
const capability = z.string().min(43).max(256).regex(/^[A-Za-z0-9_-]+$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const openAiFile = z.object({
  download_url: z.url(), file_id: z.string(), mime_type: z.string().optional(), file_name: z.string().optional(),
}).strict();
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

function safeAttachmentToolError(error) {
  const upstream = safeAuditToolError(error);
  if (upstream !== null) return upstream;
  const allowed = new Set([
    'PDF_ATTACHMENT_DESCRIPTOR_INVALID', 'PDF_ATTACHMENT_DOWNLOAD_URL_MISSING',
    'PDF_ATTACHMENT_DOWNLOAD_URL_INVALID', 'PDF_ATTACHMENT_DOWNLOAD_NETWORK_ERROR',
    'PDF_ATTACHMENT_DOWNLOAD_TIMEOUT', 'PDF_ATTACHMENT_DOWNLOAD_HTTP_ERROR',
    'PDF_ATTACHMENT_DOWNLOAD_REDIRECT_LIMIT', 'PDF_ATTACHMENT_DOWNLOAD_REDIRECT_REJECTED',
    'PDF_ATTACHMENT_MEDIA_TYPE_INVALID',
    'PDF_TOO_LARGE', 'PDF_MAGIC_INVALID', 'PDF_ATTACHMENT_BYTE_PROVENANCE_MISMATCH',
    'PDF_UPLOAD_CAPABILITY_ENVELOPE_INVALID', 'PDF_DELETE_NOT_VERIFIED',
  ]);
  const code = allowed.has(error?.code) ? error.code : allowed.has(error?.message) ? error.message : 'PDF_ATTACHMENT_AUDIT_FAILED';
  const diagnostic = error?.download;
  const safeDiagnostic = diagnostic
    && typeof diagnostic.error_class === 'string' && /^[A-Z_]{3,32}$/.test(diagnostic.error_class)
    && (diagnostic.hostname === undefined || (typeof diagnostic.hostname === 'string' && /^[a-z0-9.-]{1,253}$/.test(diagnostic.hostname)))
    && (diagnostic.status === undefined || (Number.isInteger(diagnostic.status) && diagnostic.status >= 100 && diagnostic.status <= 599))
    && Number.isInteger(diagnostic.redirect_count) && diagnostic.redirect_count >= 0 && diagnostic.redirect_count <= 3
    && Number.isInteger(diagnostic.duration_ms) && diagnostic.duration_ms >= 0
    && typeof diagnostic.correlation_id === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(diagnostic.correlation_id)
    ? diagnostic : null;
  const fields = safeDiagnostic === null ? [] : [
    `error_class=${safeDiagnostic.error_class}`,
    ...(safeDiagnostic.hostname === undefined ? [] : [`hostname=${safeDiagnostic.hostname}`]),
    ...(safeDiagnostic.status === undefined ? [] : [`status=${safeDiagnostic.status}`]),
    `redirects=${safeDiagnostic.redirect_count}`,
    `duration_ms=${safeDiagnostic.duration_ms}`,
    `correlation_id=${safeDiagnostic.correlation_id}`,
  ];
  return { isError: true, content: [{ type: 'text', text: [code, ...fields].join(' ') }] };
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

function uploadCapabilityFromSession(session) {
  const fragment = new URL(session.upload_url, 'https://preview.invalid').hash.slice(1);
  const value = new URLSearchParams(fragment).get('upload_capability');
  if (!value || !/^[A-Za-z0-9_-]{43,256}$/.test(value)) throw new Error('PDF_UPLOAD_CAPABILITY_ENVELOPE_INVALID');
  return value;
}

export async function auditPdfAttachment(args, client, auditPipeline, fileDownloader) {
  const downloaded = await fileDownloader(args.file);
  const session = await client.create({ requestedMaxBytes: downloaded.byte_length });
  let operationError;
  let result;
  try {
    const uploaded = await client.upload({
      uploadId: session.upload_id,
      capability: uploadCapabilityFromSession(session),
      bytes: downloaded.bytes,
    });
    if (uploaded.byte_sha256 !== downloaded.byte_sha256 || uploaded.byte_length !== downloaded.byte_length) {
      throw new Error('PDF_ATTACHMENT_BYTE_PROVENANCE_MISMATCH');
    }
    await client.finalize({
      uploadId: session.upload_id,
      capability: session.finalize_capability,
      expectedSha256: downloaded.byte_sha256,
    });
    const audited = await auditUploadedPdf({
      upload_id: session.upload_id,
      audit_capability: session.audit_capability,
      audit_request: args.audit_request,
    }, client, auditPipeline);
    result = {
      ...audited,
      attachment: { byte_sha256: downloaded.byte_sha256, byte_length: downloaded.byte_length },
      download: downloaded.diagnostics,
      lifecycle: { create: 'PASS', upload: 'PASS', finalize: 'PASS', audit: 'PASS', delete: 'PENDING' },
    };
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      const deleted = await client.delete({ uploadId: session.upload_id, capability: session.delete_capability });
      if (deleted?.verified_absent !== true) throw new Error('PDF_DELETE_NOT_VERIFIED');
      if (result) result.lifecycle.delete = 'PASS';
    } catch {
      throw Object.assign(new Error('PDF_DELETE_NOT_VERIFIED'), { code: 'PDF_DELETE_NOT_VERIFIED', cause: operationError });
    }
  }
  return result;
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

export function registerPdfUploadTools(server, { uploadClient, auditPipeline, fileDownloader, enableAttachmentProbe = false }) {
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

  if (fileDownloader) {
    server.registerTool('audit_pdf_attachment', {
      title: 'Audit attached PDF',
      description: 'Download the ChatGPT-provided PDF bytes, verify provenance, run the complete private audit lifecycle, and delete retained bytes.',
      inputSchema: z.object({ file: openAiFile, audit_request: z.record(z.string(), z.unknown()).default({}) }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      _meta: { 'openai/fileParams': ['file'] },
    }, async (args) => {
      try {
        return toolResult(await auditPdfAttachment(args, uploadClient, auditPipeline, fileDownloader));
      } catch (error) {
        return safeAttachmentToolError(error);
      }
    });
  }

  if (enableAttachmentProbe) {
    registerAttachmentDiagnosticTool(server);
  }
  return server;
}
