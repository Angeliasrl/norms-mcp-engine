import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const [baseUrl, outputPath] = process.argv.slice(2);
assert.ok(/^https:\/\//.test(baseUrl ?? ''), 'HTTPS base URL required');
assert.ok(outputPath, 'output path required');

const normalized = baseUrl.replace(/\/$/, '');
const pages = {};
for (const path of ['/', '/privacy', '/terms', '/support']) {
  const response = await fetch(`${normalized}${path}`, { redirect: 'error' });
  assert.equal(response.status, 200, `${path} must remain available`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  pages[path] = {
    status: response.status,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

const transport = new StreamableHTTPClientTransport(new URL(`${normalized}/mcp`));
const client = new Client({ name: 'norms-production-snapshot', version: '0.1.0' });
try {
  await client.connect(transport);
  const listed = await client.listTools();
  const demo = await client.callTool({ name: 'run_positive_current_operational_demo', arguments: {} });
  const snapshot = {
    base_url: normalized,
    server_version: client.getServerVersion(),
    tools: listed.tools.map(({ name }) => name).sort(),
    demo: demo.structuredContent,
    pages,
  };
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
} finally {
  await transport.close().catch(() => {});
}
