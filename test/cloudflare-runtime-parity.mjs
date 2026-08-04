import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { startNormsMcpServer } from '../server/index.mjs';
import { callAssessment, toolArgumentsFromFixture } from './mcp-test-helpers.mjs';

const workerBaseUrl = process.env.MCP_BASE_URL;
assert.ok(workerBaseUrl, 'MCP_BASE_URL must identify the local Workers runtime');

const fixture = JSON.parse(readFileSync(new URL(
  '../evidence/NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD/fixtures/direct-award-threshold-audit-01.json',
  import.meta.url,
), 'utf8'));

async function connect(baseUrl, name) {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  const client = new Client({ name, version: '0.1.0' });
  await client.connect(transport);
  return { client, transport };
}

const nodeServer = await startNormsMcpServer({ port: 0 });
const node = await connect(nodeServer.baseUrl, 'norms-node-parity-client');
const worker = await connect(workerBaseUrl.replace(/\/$/, ''), 'norms-worker-parity-client');

function normalizeSchemaDialect(value) {
  if (Array.isArray(value)) return value.map(normalizeSchemaDialect);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? value.replace('#/$defs/', '#/definitions/') : value;
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'execution').map(([key, nested]) => [
    key === '$defs' ? 'definitions' : key,
    key === '$schema' ? 'JSON_SCHEMA_DIALECT' : normalizeSchemaDialect(nested),
  ]));
}

try {
  assert.deepEqual(
    normalizeSchemaDialect(await worker.client.listTools()),
    normalizeSchemaDialect(await node.client.listTools()),
  );
  assert.deepEqual((await worker.client.listTools()).tools[0].annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  });

  const args = toolArgumentsFromFixture(fixture);
  const nodeResult = await callAssessment(node.client, structuredClone(args));
  const workerResult = await callAssessment(worker.client, structuredClone(args));
  assert.deepEqual(workerResult, nodeResult);

  const invalid = structuredClone(args);
  delete invalid.entry.applicability_conditions.conditions[0].facts.amount_excluding_vat_eur;
  assert.deepEqual(
    await callAssessment(worker.client, structuredClone(invalid)),
    await callAssessment(node.client, structuredClone(invalid)),
  );

  console.log('Cloudflare/Node parity tests: 3 passed');
} finally {
  await worker.transport.close().catch(() => {});
  await node.transport.close().catch(() => {});
  await nodeServer.close();
}
