import assert from 'node:assert/strict';
import http from 'node:http';
import { createResolverClient, ResolverError } from '../server/resolver-client.mjs';

const server = http.createServer((request, response) => {
  if (request.url === '/resolve') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ schema_version: 'norms-resolver-service/0.5.0', ready_for_norms: false, blocking: ['SOURCE_DISCOVERY_REQUIRED'] }));
    return;
  }
  response.writeHead(404); response.end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const client = createResolverClient({ localBaseUrl: `http://127.0.0.1:${server.address().port}` });
  const result = await client.resolve({ citation: 'synthetic', jurisdiction: 'IT', source_requirements: {}, request_id: 'local-smoke' });
  assert.equal(result.blocking[0], 'SOURCE_DISCOVERY_REQUIRED');
  assert.throws(() => createResolverClient({ localBaseUrl: 'https://resolver.example' }), (error) => error instanceof ResolverError && error.code === 'RESOLVER_LOCAL_URL_REJECTED');
  const timeout = createResolverClient({ localBaseUrl: `http://127.0.0.1:${server.address().port}`, timeoutMs: 0 });
  await assert.rejects(timeout.resolve({}), (error) => error instanceof ResolverError && error.code === 'RESOLVER_TIMEOUT');
  console.log('resolver-client local HTTP smoke: 3 passed');
} finally { await new Promise((resolve) => server.close(resolve)); }
