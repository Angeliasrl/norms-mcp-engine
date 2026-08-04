import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SERVER_INSTRUCTIONS, TOOL_NAME } from '../server/norms-tool.mjs';
import { callAssessment, toolArgumentsFromFixture, withMcpClient } from './mcp-test-helpers.mjs';

const fixture = JSON.parse(readFileSync(new URL(
  '../evidence/NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD/fixtures/direct-award-threshold-audit-01.json',
  import.meta.url,
), 'utf8'));
let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok    ${name}`);
};

console.log('\nNORMS MCP — Streamable HTTP transport\n');

await withMcpClient(async ({ client, running }) => {
  await test('initialize returns the stable server identity and instructions', async () => {
    assert.equal(client.getServerVersion().name, 'norms-structured-applicability');
    assert.equal(client.getServerVersion().version, '0.1.0');
    assert.equal(client.getInstructions(), SERVER_INSTRUCTIONS);
  });

  const listed = await client.listTools();
  await test('tools/list exposes exactly one tool', async () => {
    assert.equal(listed.tools.length, 1);
    assert.equal(listed.tools[0].name, TOOL_NAME);
  });

  await test('tool metadata, schemas, and annotations are complete', async () => {
    const tool = listed.tools[0];
    assert.equal(tool.title, 'Assess normative reliance');
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.openWorldHint, false);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.deepEqual(tool.inputSchema.required.sort(), [
      'context', 'entry', 'reliance_purpose',
    ]);
    assert.equal(tool.outputSchema.required.includes('current_operational_ground'), true);
    assert.equal(tool.outputSchema.required.includes('purpose_assessment'), true);
  });

  await test('valid tools/call returns schema-shaped structured content and concise text', async () => {
    const result = await callAssessment(client, toolArgumentsFromFixture(fixture));
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.purpose_assessment.admissible, true);
    assert.equal(result.structuredContent.purpose_assessment.authorizes_current_operational, true);
    assert.equal(result.content.length, 1);
    assert.match(result.content[0].text, /Blocking: none/);
  });

  await test('invalid tools/call has a stable sanitized error without stack or local path', async () => {
    const args = toolArgumentsFromFixture(fixture);
    delete args.entry.applicability_conditions.conditions[0].facts.amount_excluding_vat_eur;
    const result = await callAssessment(client, args);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^NORMS_INPUT_INVALID:CONDITION_FACT_MISSING\./);
    assert.doesNotMatch(result.content[0].text, /\bat\s+\S+\.m?js:\d+|[A-Z]:\\|\/Users\//i);
  });

  await test('same MCP input is deterministic', async () => {
    const args = toolArgumentsFromFixture(fixture);
    const first = await callAssessment(client, args);
    const second = await callAssessment(client, args);
    assert.deepEqual(first, second);
  });

  await test('minimal concurrent calls remain isolated and deterministic', async () => {
    const args = toolArgumentsFromFixture(fixture);
    const results = await Promise.all([
      callAssessment(client, structuredClone(args)),
      callAssessment(client, structuredClone(args)),
      callAssessment(client, structuredClone(args)),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(results[1], results[2]);
  });

  await test('health endpoint is bounded and contains no operational detail', async () => {
    const response = await fetch(`http://${running.host}:${running.port}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  await test('request bodies above the explicit limit are rejected cleanly', async () => {
    const response = await fetch(`http://${running.host}:${running.port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oversized: 'x'.repeat(70_000) }),
    });
    assert.equal(response.status, 413);
    const body = await response.json();
    assert.equal(body.error.code, -32001);
    assert.equal(body.error.message, 'Request exceeds the 65536-byte limit.');
  });
});

console.log(`MCP transport tests: ${passed} passed`);
