import { createHash } from 'node:crypto';

const SECRET_FIELD = /(upload|finalize|audit|delete)_capability/gi;
const AUTHORIZATION = /authorization\s*[:=]\s*[^,}\s]+/gi;
const URL_FRAGMENT = /(https?:\/\/[^\s"']+)#[^\s"']*/gi;

export function createInnocuousPdfFixture() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length 51 >>\nstream\nBT /F1 12 Tf 72 720 Td (NORMS preview fixture) Tj ET\nendstream',
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(new TextEncoder().encode(source).byteLength);
    source += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(source).byteLength;
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(source);
}

export const ATTESTED_PDF_FIXTURE = Object.freeze({
  byte_length: 43_654,
  byte_sha256: '254e301772cd54612d3e0e620434f3f94e341be4a94b7a43ea87642eaf2211e9',
});

export function verifyAttestedPdfFixture(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('attested PDF fixture bytes required');
  const byteSha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== ATTESTED_PDF_FIXTURE.byte_length || byteSha256 !== ATTESTED_PDF_FIXTURE.byte_sha256) {
    throw new Error('ATTESTED_PDF_FIXTURE_MISMATCH');
  }
  return { byte_length: bytes.byteLength, byte_sha256: byteSha256 };
}

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
