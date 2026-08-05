import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import { assessRelianceForPurpose } from '../src/model.js';
import {
  POSITIVE_CURRENT_OPERATIONAL_DEMO_01,
  positiveCurrentOperationalDemoInputs,
} from '../server/positive-current-operational-demo-fixture.mjs';
import {
  POSITIVE_DEMO_TOOL_NAME,
  runPositiveCurrentOperationalDemo,
  selectPositiveDemoFields,
} from '../server/positive-current-operational-demo-tool.mjs';
import { withMcpClient } from './mcp-test-helpers.mjs';

const EXPECTED = {
  authorizes_current_operational: true,
  admissible: true,
  blocking: [],
  unknown: [],
  unexamined: false,
};
const EXPECTED_KEYS = Object.keys(EXPECTED).sort();
let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok    ${name}`);
};

console.log('\npositive CURRENT_OPERATIONAL public demo\n');

await test('fixture is versioned, deeply immutable, synthetic, and open-ended', () => {
  assert.equal(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.fixture_id, 'POSITIVE_CURRENT_OPERATIONAL_DEMO_01');
  assert.equal(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.fixture_version, 1);
  assert.match(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.synthetic_notice, /synthetic/i);
  assert.equal(Object.isFrozen(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.request.entry), true);
  assert.equal(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.request.entry.effective_interval.until_exclusive, undefined);
  assert.equal(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.request.entry.applicability.until_exclusive, undefined);
});

await test('wrapper calls the canonical engine exactly once with the canonical fixture', () => {
  let calls = 0;
  const engine = (request, options) => {
    calls += 1;
    const canonical = positiveCurrentOperationalDemoInputs();
    assert.deepEqual(request, canonical.request);
    assert.deepEqual(options, canonical.options);
    return assessRelianceForPurpose(request, options);
  };
  assert.deepEqual(runPositiveCurrentOperationalDemo({ engine }), EXPECTED);
  assert.equal(calls, 1);
});

await test('wrapper result equals a direct canonical-engine call on the same fixture', () => {
  const { request, options } = positiveCurrentOperationalDemoInputs();
  const direct = selectPositiveDemoFields(assessRelianceForPurpose(request, options));
  assert.deepEqual(runPositiveCurrentOperationalDemo(), direct);
  assert.deepEqual(direct, EXPECTED);
});

await test('wrapper source contains no directly encoded verdict values', () => {
  const source = readFileSync(new URL('../server/positive-current-operational-demo-tool.mjs', import.meta.url), 'utf8');
  const verdictPath = source.slice(
    source.indexOf('export const selectPositiveDemoFields'),
    source.indexOf('export function registerPositiveCurrentOperationalDemoTool'),
  );
  assert.doesNotMatch(verdictPath, /:\s*(?:true|false|\[\s*\])/);
  assert.doesNotMatch(verdictPath, /authorizes_current_operational\s*:\s*true/);
});

await test('negative fixture mutation breaks the positive result through the engine', () => {
  const { request, options } = positiveCurrentOperationalDemoInputs();
  request.context = {
    ...request.context,
    subject: ['SYNTHETIC_NON_MATCHING_SUBJECT'],
  };
  const negative = selectPositiveDemoFields(assessRelianceForPurpose(request, options));
  assert.notDeepEqual(negative, EXPECTED);
  assert.equal(negative.authorizes_current_operational, false);
  assert.equal(negative.admissible, false);
  assert.deepEqual(negative.blocking, ['scope.mismatch']);
});

await withMcpClient(async ({ client }) => {
  await test('MCP tool has no arbitrary input and exposes no extra output fields', async () => {
    const listed = await client.listTools();
    const tool = listed.tools.find(({ name }) => name === POSITIVE_DEMO_TOOL_NAME);
    assert.ok(tool);
    assert.deepEqual(tool.inputSchema.required ?? [], []);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.deepEqual(tool.outputSchema.required.sort(), EXPECTED_KEYS);

    const result = await client.callTool({ name: POSITIVE_DEMO_TOOL_NAME, arguments: {} });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, EXPECTED);
    assert.deepEqual(Object.keys(result.structuredContent).sort(), EXPECTED_KEYS);
    assert.equal(result.content.length, 1);
    assert.deepEqual(JSON.parse(result.content[0].text), EXPECTED);

    const rejected = await client.callTool({
      name: POSITIVE_DEMO_TOOL_NAME,
      arguments: { user_supplied_fact: true },
    });
    assert.equal(rejected.isError, true);
    assert.equal(rejected.structuredContent, undefined);
  });

  await test('three consecutive MCP calls are identical, single-shot, and timed', async () => {
    const engineTimesMs = [];
    const mcpTimesMs = [];
    const results = [];
    for (let index = 0; index < 3; index += 1) {
      const engineStart = performance.now();
      const engineResult = runPositiveCurrentOperationalDemo();
      engineTimesMs.push(performance.now() - engineStart);

      const mcpStart = performance.now();
      const mcpResult = await client.callTool({ name: POSITIVE_DEMO_TOOL_NAME, arguments: {} });
      mcpTimesMs.push(performance.now() - mcpStart);
      results.push(mcpResult.structuredContent);
      assert.deepEqual(mcpResult.structuredContent, engineResult);
    }
    assert.deepEqual(results, [EXPECTED, EXPECTED, EXPECTED]);
    assert.equal(mcpTimesMs.every((duration) => duration < 2000), true);
    console.log(`  timing engine_ms=${engineTimesMs.map((value) => value.toFixed(3)).join(',')} mcp_ms=${mcpTimesMs.map((value) => value.toFixed(3)).join(',')}`);
  });
});

console.log(`Positive CURRENT_OPERATIONAL demo tests: ${passed} passed`);
