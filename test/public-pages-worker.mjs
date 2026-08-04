import assert from 'node:assert/strict';

import {
  PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE,
  PUBLIC_CURRENT_OPERATIONAL_EXAMPLE,
  publicInputSchema,
} from '../server/public-input-contract.mjs';

const baseUrl = process.env.MCP_BASE_URL;
assert.ok(baseUrl, 'MCP_BASE_URL must identify a Workers runtime');

for (const path of ['/', '/input-contract', '/privacy', '/terms', '/support']) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html; charset=utf-8$/);
  assert.equal(response.headers.get('set-cookie'), null);
  const html = await response.text();
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<script\b|<form\b|<iframe\b|\s(?:src|action)="https?:\/\//i);
  for (const link of ['/', '/input-contract', '/privacy', '/terms', '/support']) assert.match(html, new RegExp(`href="${link}"`));
}

assert.equal(publicInputSchema.safeParse(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE).success, true);
assert.equal(publicInputSchema.safeParse(PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE).success, true);
const contractPage = await (await fetch(`${baseUrl}/input-contract`)).text();
assert.match(contractPage, /NORMS assesses records already structured and ratified/);
assert.match(contractPage, /blocking: \[\]/);
assert.match(contractPage, /SYNTHETIC_PUBLIC_ENTRY_2040/);
assert.match(contractPage, /COMPARATIVE_ANALYSIS/);
assert.match(contractPage, /github\.com\/Angeliasrl\/norms-mcp-engine/);

const challenge = await fetch(`${baseUrl}/.well-known/openai-apps-challenge`, { redirect: 'manual' });
assert.equal(challenge.status, 404);
assert.equal(challenge.headers.get('location'), null);

assert.equal((await fetch(`${baseUrl}/mcp`)).status, 405);
assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
assert.equal((await fetch(`${baseUrl}/not-found`)).status, 404);

console.log('Public pages Workers tests: 19 passed');
