import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { callAssessment, toolArgumentsFromFixture, withMcpClient } from './mcp-test-helpers.mjs';

const realFixture = JSON.parse(readFileSync(new URL(
  '../evidence/NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD/fixtures/direct-award-threshold-audit-01.json',
  import.meta.url,
), 'utf8'));

const proof = (suffix, char) => ({
  date: '2031-12-15',
  document: `synthetic-${suffix}.json`,
  sha256: char.repeat(64),
  section_id: `synthetic-${suffix}`,
});
const completenessProof = {
  ...proof('completeness', 'f'),
  rule_id: 'SYNTHETIC_COMPLETENESS_RULE_01',
  evaluator_id: 'SYNTHETIC_EVALUATOR_01',
  authority_id: 'SYNTHETIC_AUTHORITY_01',
};
const syntheticArguments = () => ({
  entry: {
    key: 'SYNTHETIC_NORMATIVE_UNIT_2032',
    value: 'SYNTHETIC_FREE_TEXT_NOT_USED_AS_EVIDENCE',
    origin: { type: 'SOURCE_DOCUMENT', date: '2031-12-15' },
    verification_state: 'RATIFIED',
    currency: 'CURRENT',
    authority_status: 'VALID',
    expiry_status: 'ACTIVE',
    ratification: proof('entry', 'e'),
    scope: {
      subject: ['SYNTHETIC_SCOPE_01'],
      jurisdiction: ['SYNTHETIC_JURISDICTION_01'],
      applicable_operations: ['SYNTHETIC_OPERATION_01'],
    },
    effective_interval: { from: '2032-01-01', until_exclusive: '2033-01-01' },
    normative_unit: {
      instrument: 'SYNTHETIC_INSTRUMENT_2032',
      provision: 'SYNTHETIC_PROVISION_01',
      classification_basis: 'SYNTHETIC_CLASSIFICATION_01',
    },
    provision_segmentation: { status: 'SEGMENTED' },
    applicability: { from: '2032-01-01', until_exclusive: '2033-01-01' },
    applicability_conditions: {
      completeness: 'COMPLETE',
      completeness_evaluation: {
        mode: 'EXTERNAL_EVALUATION_REQUIRED',
        evaluation: {
          outcome: 'SATISFIED',
          verification_state: 'RATIFIED',
          evidence: [{
            type: 'DOCUMENT_REFERENCE',
            reference: 'synthetic-completeness.json#synthetic-completeness',
          }],
          ratification: completenessProof,
        },
      },
      conditions: [{
        id: 'SYNTHETIC_ATOMIC_FACT_01',
        evaluation_mode: 'ENGINE_EVALUATED',
        predicate: {
          operator: 'BOOLEAN_IS',
          left_fact: 'synthetic_required_fact',
          right_value: true,
        },
        facts: { synthetic_required_fact: true },
        evidence: [{
          type: 'DOCUMENT_REFERENCE',
          reference: 'synthetic-fact.json#synthetic-required-fact',
        }],
      }],
    },
  },
  context: {
    subject: ['SYNTHETIC_SCOPE_01'],
    jurisdiction: ['SYNTHETIC_JURISDICTION_01'],
    applicable_operations: ['SYNTHETIC_OPERATION_01'],
  },
  reliance_purpose: 'CURRENT_OPERATIONAL',
  as_of: '2032-06-15',
  trusted_external_evaluations: [{
    evidence_package_sha256: completenessProof.sha256,
    rule_id: completenessProof.rule_id,
    evaluator_id: completenessProof.evaluator_id,
    authority_id: completenessProof.authority_id,
    outcome: 'SATISFIED',
  }],
});

let passed = 0;
let positive = 0;
let negative = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok    ${name}`);
};
const assertPositive = (result) => {
  assert.notEqual(result.isError, true);
  const assessment = result.structuredContent.purpose_assessment;
  assert.equal(assessment.authorizes_current_operational, true);
  assert.equal(assessment.admissible, true);
  assert.deepEqual(assessment.blocking, []);
  assert.deepEqual(assessment.unknown, []);
  assert.equal(assessment.unexamined, false);
  positive += 1;
};
const assertNegative = (result) => {
  if (result.isError === true) {
    negative += 1;
    return;
  }
  const assessment = result.structuredContent.purpose_assessment;
  assert.equal(assessment.authorizes_current_operational, false);
  assert.equal(assessment.admissible, false);
  negative += 1;
};

console.log('\nNORMS MCP — OpenAI submission cases\n');

await withMcpClient(async ({ client }) => {
  await test('P1 caller-supplied trust cannot authorize a complete synthetic record', async () => {
    assertNegative(await callAssessment(client, syntheticArguments()));
  });
  await test('P2 engine-derived atomic fact cannot bypass untrusted completeness', async () => {
    const args = syntheticArguments();
    const result = await callAssessment(client, args);
    assertNegative(result);
    assert.equal(result.structuredContent.purpose_assessment.conditions_satisfied, false);
    assert.equal(result.structuredContent.purpose_assessment.condition_completeness_verified, false);
    assert.equal(result.structuredContent.purpose_assessment.condition_results[0].basis, 'ENGINE_DERIVED');
  });
  await test('P3 matching interval cannot bypass untrusted completeness', async () => {
    const result = await callAssessment(client, syntheticArguments());
    assertNegative(result);
    assert.equal(result.structuredContent.purpose_assessment.applicability_matches, true);
  });
  await test('P4 minimized real fixture remains closed without server trust policy', async () => {
    const result = await callAssessment(client, toolArgumentsFromFixture(realFixture));
    assertNegative(result);
    assert.doesNotMatch(result.content[0].text, /legal(?:ly)? compliant|overall legality/i);
  });
  await test('P5 repeated MCP execution is structurally deterministic', async () => {
    const args = syntheticArguments();
    const first = await callAssessment(client, args);
    const second = await callAssessment(client, args);
    assert.deepEqual(first, second);
    assertNegative(first);
  });
  await test('N1 unknown authority fails closed even with no adverse authority finding', async () => {
    const args = syntheticArguments();
    args.entry.authority_status = 'UNKNOWN';
    const result = await callAssessment(client, args);
    assertNegative(result);
    assert.equal(result.structuredContent.purpose_assessment.unknown.includes('authority.unknown'), true);
  });
  await test('N2 absent selected provision fails closed', async () => {
    const args = syntheticArguments();
    delete args.entry.normative_unit.provision;
    const result = await callAssessment(client, args);
    assertNegative(result);
    assert.equal(result.structuredContent.purpose_assessment.unknown.includes('normative_unit.provision_missing'), true);
  });
  await test('N3 fact present only in free text is rejected without inference', async () => {
    const args = syntheticArguments();
    delete args.entry.applicability_conditions.conditions[0].facts.synthetic_required_fact;
    args.entry.value = 'synthetic_required_fact=true; FREE TEXT MUST NOT BE EVIDENCE';
    const result = await callAssessment(client, args);
    assertNegative(result);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /CONDITION_FACT_MISSING/);
  });
});

assert.equal(positive, 0);
assert.equal(negative, 8);
console.log(`MCP submission cases: ${passed} passed, ${positive} positive, ${negative} fail-closed/rejected`);
