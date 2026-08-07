import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const baseUrl = 'http://127.0.0.1:8791';
const persistPath = await mkdtemp(join(tmpdir(), 'norms-pdf-do-rpc-'));
const config = 'test/wrangler.pdf-upload-durable-object-rpc.jsonc';
const capabilities = [];

const redact = (value) => capabilities.reduce((text, capability) => text.replaceAll(capability, '[REDACTED]'), String(value));

async function startWorkerd() {
  const child = spawn(process.execPath, [
    'node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--config', config,
    '--ip', '127.0.0.1', '--port', '8791', '--persist-to', persistPath,
  ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
  let diagnostics = '';
  child.stdout.on('data', (chunk) => { diagnostics += chunk; });
  child.stderr.on('data', (chunk) => { diagnostics += chunk; });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`workerd exited early: ${redact(diagnostics)}`);
    try { if ((await fetch(`${baseUrl}/healthz`)).ok) return child; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`workerd did not become ready: ${redact(diagnostics)}`);
}

async function stopWorkerd(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 10_000))]);
}

async function connect() {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  const client = new Client({ name: 'pdf-upload-durable-object-rpc-test', version: '0.1.0' });
  await client.connect(transport);
  return { client, transport };
}

let workerd;
try {
  workerd = await startWorkerd();
  let connection = await connect();
  const created = (await connection.client.callTool({ name: 'create_pdf_upload_session', arguments: { max_bytes: 1024 * 1024 } })).structuredContent;
  assert(created, 'session creation must cross the Durable Object RPC binding');
  assert.deepEqual(Object.keys(created).sort(), [
    'audit_capability', 'delete_capability', 'expires_at', 'finalize_capability', 'max_bytes', 'upload_id', 'upload_url',
  ]);
  const uploadTarget = new URL(created.upload_url, baseUrl);
  const uploadCapability = new URLSearchParams(uploadTarget.hash.slice(1)).get('upload_capability');
  assert(uploadCapability);
  capabilities.push(uploadCapability, created.finalize_capability, created.audit_capability, created.delete_capability);
  uploadTarget.hash = '';
  const pdf = new Uint8Array(await readFile(new URL(
    '../evidence/NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD/raw/CCIAA_Firenze_Determinazione_41_2024.pdf',
    import.meta.url,
  )));
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  const uploadedResponse = await fetch(uploadTarget, {
    method: 'PUT',
    headers: { authorization: `Capability ${uploadCapability}`, 'content-type': 'application/pdf', 'content-length': String(pdf.byteLength) },
    body: pdf,
  });
  assert.equal(uploadedResponse.status, 200);
  assert.equal((await uploadedResponse.json()).byte_sha256, sha256);
  await connection.transport.close();
  await stopWorkerd(workerd);

  workerd = await startWorkerd();
  connection = await connect();
  const finalized = (await connection.client.callTool({ name: 'finalize_pdf_upload', arguments: {
    upload_id: created.upload_id, finalize_capability: created.finalize_capability, expected_sha256: sha256,
  } })).structuredContent;
  assert.deepEqual(finalized, { state: 'FINALIZED', byte_sha256: sha256 });
  const replay = await connection.client.callTool({ name: 'finalize_pdf_upload', arguments: {
    upload_id: created.upload_id, finalize_capability: created.finalize_capability, expected_sha256: sha256,
  } });
  assert.equal(replay.isError, true);
  assert.match(replay.content[0].text, /CAPABILITY_REPLAYED|One-use capability/);
  const deleted = (await connection.client.callTool({ name: 'delete_pdf_upload', arguments: {
    upload_id: created.upload_id, delete_capability: created.delete_capability,
  } })).structuredContent;
  assert.deepEqual(deleted, { upload_id: created.upload_id, deleted: true, verified_absent: true });
  await connection.transport.close();
  console.log('pdf-upload-durable-object-rpc workerd binding: PASS');
} finally {
  if (workerd) await stopWorkerd(workerd);
  await rm(persistPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}
