import { pathToFileURL } from 'node:url';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createNormsMcpServer } from './norms-tool.mjs';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3000;
export const MAX_REQUEST_BYTES = 64 * 1024;
export const REQUEST_TIMEOUT_MS = 5_000;

const protocolError = (res, status, code, message) => {
  if (res.headersSent) return;
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
};

export function createNormsHttpApp({ host = DEFAULT_HOST } = {}) {
  const app = createMcpExpressApp({ host });

  app.use((req, res, next) => {
    req.setTimeout(REQUEST_TIMEOUT_MS);
    res.setTimeout(REQUEST_TIMEOUT_MS);
    const declaredLength = Number(req.headers['content-length'] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      protocolError(res, 413, -32001, 'Request exceeds the 65536-byte limit.');
      return;
    }
    if (req.body !== undefined && Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_REQUEST_BYTES) {
      protocolError(res, 413, -32001, 'Request exceeds the 65536-byte limit.');
      return;
    }
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/mcp', async (req, res) => {
    const server = createNormsMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    };
    res.once('close', close);
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      protocolError(res, 500, -32603, 'Internal server error.');
    } finally {
      if (res.writableEnded) await close();
    }
  });

  app.all('/mcp', (_req, res) => {
    protocolError(res, 405, -32000, 'Method not allowed. Use POST /mcp.');
  });

  app.use((_error, _req, res, _next) => {
    protocolError(res, 400, -32700, 'Invalid JSON request.');
  });

  return app;
}

export async function startNormsMcpServer({
  host = process.env.NORMS_MCP_HOST ?? DEFAULT_HOST,
  port = Number(process.env.PORT ?? DEFAULT_PORT),
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer from 0 through 65535');
  }
  const app = createNormsHttpApp({ host });
  const httpServer = await new Promise((resolve, reject) => {
    const listener = app.listen(port, host, () => resolve(listener));
    listener.once('error', reject);
  });
  return {
    app,
    httpServer,
    host,
    port: httpServer.address().port,
    baseUrl: `http://${host}:${httpServer.address().port}`,
    close: () => new Promise((resolve, reject) => {
      httpServer.close((error) => error ? reject(error) : resolve());
    }),
  };
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  const running = await startNormsMcpServer();
  process.stdout.write(`NORMS MCP server listening on http://${running.host}:${running.port}/mcp\n`);
  const shutdown = async () => {
    await running.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
