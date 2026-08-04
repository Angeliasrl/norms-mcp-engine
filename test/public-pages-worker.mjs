import assert from 'node:assert/strict';

const baseUrl = process.env.MCP_BASE_URL;
assert.ok(baseUrl, 'MCP_BASE_URL must identify a Workers runtime');

for (const path of ['/', '/privacy', '/terms', '/support']) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html; charset=utf-8$/);
  assert.equal(response.headers.get('set-cookie'), null);
  const html = await response.text();
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<script\b|<form\b|<iframe\b|https?:\/\//i);
  for (const link of ['/', '/privacy', '/terms', '/support']) assert.match(html, new RegExp(`href="${link}"`));
}

const challenge = await fetch(`${baseUrl}/.well-known/openai-apps-challenge`, { redirect: 'manual' });
assert.equal(challenge.status, 404);
assert.equal(challenge.headers.get('location'), null);

assert.equal((await fetch(`${baseUrl}/mcp`)).status, 405);
assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
assert.equal((await fetch(`${baseUrl}/not-found`)).status, 404);

console.log('Public pages Workers tests: 12 passed');
