import assert from 'node:assert/strict';

import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';

import {
  PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE,
  PUBLIC_CURRENT_OPERATIONAL_EXAMPLE,
} from '../server/public-input-contract.mjs';
import { callAssessment, withMcpClient } from './mcp-test-helpers.mjs';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok    ${name}`);
};

const errorText = async (client, args) => {
  const result = await callAssessment(client, args);
  assert.equal(result.isError, true);
  const text = result.content[0].text;
  assert.doesNotMatch(text, /\bat\s+\S+\.m?js:\d+|[A-Z]:\\|\/Users\//i);
  return text;
};

console.log('\nNORMS MCP — canonical public input contract\n');

await withMcpClient(async ({ client }) => {
  const listed = await client.listTools();
  const tool = listed.tools.find(({ name }) => name === 'assess_normative_reliance');
  const schema = tool.inputSchema;

  await test('assessment tool retains its strict typed schema with reusable definitions', async () => {
    assert.equal(listed.tools.length, 2);
    assert.equal(tool.name, 'assess_normative_reliance');
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.oneOf.length, 3);
    assert.ok(Object.keys(schema.definitions ?? schema.$defs).length >= 20);
    assert.match(schema.properties.entry.$ref, /NormativeEntry$/);
    assert.match(schema.properties.context.$ref, /Context$/);
  });

  const AjvDialect = schema.$schema?.includes('2020-12') ? Ajv2020 : Ajv;
  const ajv = new AjvDialect({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  await test('client-side JSON Schema validation accepts both published fixtures', async () => {
    assert.equal(validate(structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE)), true, JSON.stringify(validate.errors));
    assert.equal(validate(structuredClone(PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE)), true, JSON.stringify(validate.errors));
  });

  await test('published CURRENT_OPERATIONAL fixture reaches the positive engine path', async () => {
    const result = await callAssessment(client, structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE));
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.purpose_assessment.authorizes_current_operational, true);
  });

  await test('published COMPARATIVE_ANALYSIS fixture is accepted without as_of', async () => {
    const result = await callAssessment(client, structuredClone(PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE));
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.purpose_assessment.purpose, 'COMPARATIVE_ANALYSIS');
    assert.equal(Object.hasOwn(result.structuredContent.purpose_assessment, 'as_of'), false);
  });

  await test('required nested field is rejected with its path', async () => {
    const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
    delete args.entry.authority_status;
    assert.equal(validate(args), false);
    assert.ok(validate.errors.some((error) => error.keyword === 'required' && error.instancePath === '/entry'));
    assert.match(await errorText(client, args), /(?:required at entry\.authority_status|entry\.authority_status: required)/);
  });

  await test('invalid enum reports path and allowed values', async () => {
    const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
    args.entry.verification_state = 'BOGUS';
    const text = await errorText(client, args);
    assert.match(text, /entry\.verification_state/);
    assert.match(text, /RATIFIED.*UNCONFIRMED/);
  });

  for (const purpose of ['CURRENT_OPERATIONAL', 'HISTORICAL_AS_OF']) {
    await test(`as_of is required for ${purpose}`, async () => {
      const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
      args.reliance_purpose = purpose;
      delete args.as_of;
      assert.equal(validate(args), false);
      assert.match(await errorText(client, args), new RegExp(`(?:required for ${purpose} at as_of|as_of: required for ${purpose})`));
    });
  }

  await test('as_of is forbidden for COMPARATIVE_ANALYSIS', async () => {
    const args = structuredClone(PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE);
    args.as_of = '2040-06-15';
    assert.equal(validate(args), false);
    assert.match(await errorText(client, args), /(?:must be absent for COMPARATIVE_ANALYSIS at as_of|as_of: must be absent for COMPARATIVE_ANALYSIS)/);
  });

  await test('unknown top-level properties are rejected', async () => {
    const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
    args.as_fo = args.as_of;
    assert.match(await errorText(client, args), /Unrecognized key: "as_fo"/);
  });

  await test('unknown nested decision properties are rejected with the object path', async () => {
    const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
    args.entry.authority_state = 'VALID';
    assert.match(await errorText(client, args), /(?:Unrecognized key: "authority_state" at entry|entry: Unrecognized key: "authority_state")/);
  });

  await test('unknown properties inside a principal nested object are rejected', async () => {
    const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
    args.entry.normative_unit.authority_state = 'VALID';
    assert.match(await errorText(client, args), /normative_unit.*authority_state|authority_state.*normative_unit/);
  });

  await test('missing context jurisdiction is rejected with its path', async () => {
    const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
    delete args.context.jurisdiction;
    assert.match(await errorText(client, args), /(?:required at context\.jurisdiction|context\.jurisdiction: required)/);
  });

  await test('same valid public fixture remains deterministic', async () => {
    const args = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
    assert.deepEqual(await callAssessment(client, args), await callAssessment(client, args));
  });
});

console.log(`MCP public input contract tests: ${passed} passed`);
