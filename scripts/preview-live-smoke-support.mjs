const SECRET_FIELD = /(upload|finalize|audit|delete)_capability/gi;
const AUTHORIZATION = /authorization\s*[:=]\s*[^,}\s]+/gi;
const URL_FRAGMENT = /(https?:\/\/[^\s"']+)#[^\s"']*/gi;

export function redactDiagnostic(value) {
  return String(value ?? 'unknown MCP error')
    .replace(URL_FRAGMENT, '$1#[REDACTED]')
    .replace(AUTHORIZATION, 'authorization=[REDACTED]')
    .replace(SECRET_FIELD, '[REDACTED_FIELD]');
}

export async function callToolStructured(client, request) {
  let response;
  try {
    response = await client.callTool(request);
  } catch (error) {
    throw new Error(`MCP_JSON_RPC_ERROR: ${redactDiagnostic(error?.message ?? error)}`);
  }
  if (response?.isError) {
    const detail = Array.isArray(response.content)
      ? response.content.filter((item) => item?.type === 'text').map((item) => item.text).join(' ')
      : 'tool returned isError without text content';
    throw new Error(`MCP_TOOL_ERROR: ${redactDiagnostic(detail)}`);
  }
  if (!response || typeof response.structuredContent !== 'object' || response.structuredContent === null) {
    throw new Error('MCP_RESULT_ENVELOPE_INVALID: successful tool result omitted structuredContent');
  }
  return response.structuredContent;
}

export async function withPdfDelete(client, session, operation) {
  let operationError;
  try {
    return await operation();
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    if (session?.upload_id && session?.delete_capability) {
      try {
        const deleted = await callToolStructured(client, { name: 'delete_pdf_upload', arguments: {
          upload_id: session.upload_id,
          delete_capability: session.delete_capability,
        } });
        if (deleted.verified_absent !== true) throw new Error('PDF_DELETE_NOT_VERIFIED');
      } catch (cleanupError) {
        if (!operationError) throw cleanupError;
        operationError.cleanup_error = redactDiagnostic(cleanupError?.message ?? cleanupError);
      }
    }
  }
}
