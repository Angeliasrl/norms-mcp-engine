import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { Container, ContainerProxy } from '@cloudflare/containers';

import { SERVER_INSTRUCTIONS, registerNormsTool } from '../server/norms-tool.mjs';
import { auditVerifiedDocumentBundle } from '../server/pdf-audit-pipeline.mjs';
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

  constructor(ctx, env) {
    super(ctx, env);
    // Terza gamba (0.6.0): il canale verso norms-resolver-v1 e il prefisso ULA
    // dell'egress-proxy Cloudflare arrivano dalle vars del worker; senza vars
    // il container resta identico a prima (guardia strict, nessun canale).
    if (env.NORMS_RESOLVER_URL) {
      this.allowedHosts = [...this.allowedHosts, new URL(env.NORMS_RESOLVER_URL).hostname];
      this.envVars = { ...this.envVars, NORMS_RESOLVER_URL: env.NORMS_RESOLVER_URL };
    }
    if (env.NORMS_CF_EGRESS_ULA_PREFIX) {
      this.envVars = { ...this.envVars, NORMS_CF_EGRESS_ULA_PREFIX: env.NORMS_CF_EGRESS_ULA_PREFIX };
    }
  }
}

// Il fetch worker->worker via workers.dev dello stesso account è bloccato
// (errore 1042): l'egress intercettato verso norms-resolver-v1 viaggia sul
// service binding dedicato.
NormsResolverContainer.outboundByHost = {
  'norms-resolver-v1.friva1947.workers.dev': (request, env) => env.NORMS_DB_RESOLVER.fetch(request),
};

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

const pdfUploadBindingsPresent = (env) => Boolean(
  env.NORMS_RESOLVER
  && env.PDF_UPLOAD_COORDINATOR
  && env.PDF_UPLOADS
  && typeof env.PDF_UPLOAD_CAPABILITY_HMAC_KEY === 'string',
);

const createWorkerMcpServer = (env) => registerNormsTool(new McpServer(
  { name: 'norms-structured-applicability', version: '0.2.2' },
  { instructions: SERVER_INSTRUCTIONS },
), {
  resolverClient: resolverClientFromEnv(env),
  ...(pdfUploadBindingsPresent(env) ? {
    uploadClient: pdfUploadClientFromEnv(env),
    fileDownloader: createChatGptFileDownloader(),
    auditPipeline: auditVerifiedDocumentBundle,
  } : {}),
  enableAttachmentProbe: env.PDF_ATTACHMENT_PROBE_ENABLED === 'true',
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
