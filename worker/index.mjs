import { createHash } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { Container, ContainerProxy } from '@cloudflare/containers';

import { SERVER_INSTRUCTIONS, registerNormsTool } from '../server/norms-tool.mjs';
import { resolverClientFromEnv } from '../server/resolver-client.mjs';
import { publicPageResponse } from './public-pages.mjs';
import { PdfUploadDurableObject } from './pdf-upload-cloudflare.mjs';
import { createChatGptFileDownloader, handlePdfUploadRequest, pdfUploadClientFromEnv } from './pdf-upload-http.mjs';

const MAX_REQUEST_BYTES = 64 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const MAX_REQUEST_TIMEOUT_MS = 60_000;

export { ContainerProxy, PdfUploadDurableObject };

export class NormsResolverContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '2m';
  enableInternet = false;
  interceptHttps = true;
  allowedHosts = [
    'normattiva.it',
    '*.normattiva.it',
    'gazzettaufficiale.it',
    '*.gazzettaufficiale.it',
    'eur-lex.europa.eu',
    'publications.europa.eu',
    'normelombardia.consiglio.regione.lombardia.it',
  ];
  envVars = {
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUNBUFFERED: '1',
    NORMS_RESOLVER_TMP: '/tmp/norms',
    NORMS_RESOLVER_EVIDENCE_DIR: '/var/lib/norms/evidence',
    SSL_CERT_FILE: '/etc/cloudflare/certs/cloudflare-containers-ca.crt',
  };
}

function requestTimeoutMs(env) {
  const configured = Number(env?.MCP_REQUEST_TIMEOUT_MS ?? DEFAULT_REQUEST_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= DEFAULT_REQUEST_TIMEOUT_MS
    ? Math.min(configured, MAX_REQUEST_TIMEOUT_MS)
    : DEFAULT_REQUEST_TIMEOUT_MS;
}

const protocolError = (status, code, message) => Response.json(
  { jsonrpc: '2.0', error: { code, message }, id: null },
  { status },
);

const canonicalJson = (value) => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;

const acknowledgeVerifiedDocumentBundle = async ({ document_bundle: documentBundle }) => ({
  document_bundle_sha256: createHash('sha256').update(canonicalJson(documentBundle)).digest('hex'),
  blocking: ['PDF_NORMATIVE_ASSESSMENT_NOT_REQUESTED'],
  limitations: ['NORMS_CORE_NOT_CALLED'],
});

const createWorkerMcpServer = (env) => registerNormsTool(new McpServer(
  { name: 'norms-structured-applicability', version: '0.2.1' },
  { instructions: SERVER_INSTRUCTIONS },
), {
  resolverClient: resolverClientFromEnv(env),
  ...(env.ENVIRONMENT === 'preview' ? {
    uploadClient: pdfUploadClientFromEnv(env),
    fileDownloader: createChatGptFileDownloader(),
    auditPipeline: acknowledgeVerifiedDocumentBundle,
  } : {}),
  enableAttachmentProbe: env.ENVIRONMENT === 'preview' && env.PDF_ATTACHMENT_PROBE_ENABLED === 'true',
});

async function handleWithTimeout(request, env, ctx) {
  const timeoutMs = requestTimeoutMs(env);
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(
      protocolError(504, -32002, 'Request exceeded the configured processing limit.'),
    ), timeoutMs);
  });
  try {
    const mcpHandler = createMcpHandler(() => createWorkerMcpServer(env), {
      route: '/mcp', corsOptions: false,
    });
    return await Promise.race([mcpHandler(request, env, ctx), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function boundedRequest(request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null;
  if (request.body === null) return request;

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return new Request(request, { body, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pdfResponse = await handlePdfUploadRequest(request, env);
    if (pdfResponse !== null) return pdfResponse;
    const publicResponse = publicPageResponse(url.pathname, request.method, env);
    if (publicResponse !== null) return publicResponse;
    if (url.pathname === '/healthz') {
      if (request.method !== 'GET') {
        return protocolError(405, -32000, 'Method not allowed. Use GET /healthz.');
      }
      return Response.json({ status: 'ok' });
    }
    if (url.pathname !== '/mcp') return new Response('Not Found', { status: 404 });
    if (request.method !== 'POST') {
      return protocolError(405, -32000, 'Method not allowed. Use POST /mcp.');
    }

    try {
      const bounded = await boundedRequest(request);
      if (bounded === null) {
        return protocolError(413, -32001, 'Request exceeds the 65536-byte limit.');
      }
      return await handleWithTimeout(bounded, env, ctx);
    } catch {
      return protocolError(500, -32603, 'Internal server error.');
    }
  },
};
