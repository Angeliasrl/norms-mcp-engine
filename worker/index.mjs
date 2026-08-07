import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';

import { SERVER_INSTRUCTIONS, registerNormsTool } from '../server/norms-tool.mjs';
import { publicPageResponse } from './public-pages.mjs';

const MAX_REQUEST_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;

const protocolError = (status, code, message) => Response.json(
  { jsonrpc: '2.0', error: { code, message }, id: null },
  { status },
);

const createWorkerMcpServer = () => registerNormsTool(new McpServer(
  { name: 'norms-structured-applicability', version: '0.1.1' },
  { instructions: SERVER_INSTRUCTIONS },
));

const mcpHandler = createMcpHandler(createWorkerMcpServer, {
  route: '/mcp',
  corsOptions: false,
});

async function handleWithTimeout(request, env, ctx) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(
      protocolError(504, -32002, 'Request exceeded the 5000-millisecond processing limit.'),
    ), REQUEST_TIMEOUT_MS);
  });
  try {
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
