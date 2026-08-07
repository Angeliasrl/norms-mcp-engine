import assert from 'node:assert/strict';

import { assessRelianceForPurpose } from '../src/model.js';
import { PUBLIC_CURRENT_OPERATIONAL_EXAMPLE } from '../server/public-input-contract.mjs';
import {
  TRUST_BOUNDARY_CLASSIFICATION,
  TRUST_BOUNDARY_REASON,
  TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_VERSION,
  resolveServerTrustedExternalEvaluations,
} from '../server/trusted-external-evaluation-boundary.mjs';
import { callAssessment, withMcpClient } from './mcp-test-helpers.mjs';

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok    ${name}`);
};
const args = () => structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
const coreInputs = (value) => {
  const { trusted_external_evaluations, ...request } = value;
  return { request, options: { trusted_external_evaluations } };
};
const assertBoundaryClosed = async (client, value) => {
  const result = await callAssessment(client, value);
  assert.notEqual(result.isError, true);
  const assessment = result.structuredContent.purpose_assessment;
  assert.deepEqual(result.structuredContent.trust_boundary, {
    boundary_version: TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_VERSION,
    classification: TRUST_BOUNDARY_CLASSIFICATION.CALLER_SUPPLIED_UNTRUSTED,
    caller_supplied_count: value.trusted_external_evaluations.length,
    accepted_count: 0,
    reason_codes: [
      TRUST_BOUNDARY_REASON.CALLER_SUPPLIED_UNTRUSTED,
      TRUST_BOUNDARY_REASON.NO_SERVER_TRUST_POLICY,
    ],
  });
  assert.equal(assessment.authorizes_current_operational, false);
  assert.equal(assessment.admissible, false);
  assert.equal(assessment.conditions_known, false);
  assert.equal(assessment.condition_completeness_verified, false);
  assert.equal(assessment.condition_completeness_result.basis, 'CALLER_ASSERTED_UNCONFIRMED');
  assert.equal(assessment.external_evaluation_required, true);
  assert.equal(assessment.unknown.includes(TRUST_BOUNDARY_REASON.CALLER_SUPPLIED_UNTRUSTED), true);
  assert.equal(assessment.unknown.includes(TRUST_BOUNDARY_REASON.NO_SERVER_TRUST_POLICY), true);
  assert.equal(assessment.unexamined, true);
  return assessment;
};

console.log('\nNORMS MCP — trusted external evaluation boundary 0.1.1\n');

await test('regression proof: the unchanged Core authorizes coordinated caller assertions', () => {
  const value = args();
  const { request, options } = coreInputs(value);
  const result = assessRelianceForPurpose(request, options).purpose_assessment;
  assert.equal(result.authorizes_current_operational, true);
  assert.equal(result.condition_completeness_result.basis, 'EXTERNALLY_RATIFIED');
});

await test('resolver classifies public registry as untrusted and returns an empty internal registry', () => {
  const supplied = args().trusted_external_evaluations;
  const before = structuredClone(supplied);
  const resolved = resolveServerTrustedExternalEvaluations(supplied);
  assert.equal(resolved.boundary_version, TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_VERSION);
  assert.equal(resolved.classification, TRUST_BOUNDARY_CLASSIFICATION.CALLER_SUPPLIED_UNTRUSTED);
  assert.deepEqual(resolved.trusted_external_evaluations, []);
  assert.equal(resolved.caller_supplied_count, 1);
  assert.equal(resolved.accepted_count, 0);
  assert.deepEqual(supplied, before);
});

await test('default has no trusted authority or implicit trust', () => {
  const resolved = resolveServerTrustedExternalEvaluations(undefined);
  assert.equal(resolved.classification, TRUST_BOUNDARY_CLASSIFICATION.NOT_SUPPLIED);
  assert.deepEqual(resolved.trusted_external_evaluations, []);
  assert.deepEqual(resolved.reason_codes, []);
});

await withMcpClient(async ({ client }) => {
  await test('coordinated inline evaluation, ratification and top-level registry fail closed', async () => {
    await assertBoundaryClosed(client, args());
  });

  const cases = [
    ['invented identities', (value) => {
      const proof = value.entry.applicability_conditions.completeness_evaluation.evaluation.ratification;
      proof.evaluator_id = 'CALLER_INVENTED_EVALUATOR';
      proof.authority_id = 'CALLER_INVENTED_AUTHORITY';
      proof.rule_id = 'CALLER_INVENTED_RULE';
      Object.assign(value.trusted_external_evaluations[0], {
        evaluator_id: proof.evaluator_id,
        authority_id: proof.authority_id,
        rule_id: proof.rule_id,
      });
    }],
    ['nonexistent package hash', (value) => {
      const digest = '9'.repeat(64);
      value.entry.applicability_conditions.completeness_evaluation.evaluation.ratification.sha256 = digest;
      value.trusted_external_evaluations[0].evidence_package_sha256 = digest;
    }],
    ['identical duplicates', (value) => {
      value.trusted_external_evaluations.push(structuredClone(value.trusted_external_evaluations[0]));
    }],
    ['conflicting outcomes', (value) => {
      value.trusted_external_evaluations.push({
        ...value.trusted_external_evaluations[0], outcome: 'NOT_SATISFIED',
      });
    }],
    ['different evaluator', (value) => { value.trusted_external_evaluations[0].evaluator_id = 'OTHER'; }],
    ['different authority', (value) => { value.trusted_external_evaluations[0].authority_id = 'OTHER'; }],
    ['different rule', (value) => { value.trusted_external_evaluations[0].rule_id = 'OTHER'; }],
    ['different digest', (value) => { value.trusted_external_evaluations[0].evidence_package_sha256 = '8'.repeat(64); }],
  ];

  for (const [name, mutate] of cases) {
    await test(`${name} cannot establish server trust`, async () => {
      const value = args();
      mutate(value);
      await assertBoundaryClosed(client, value);
    });
  }

  await test('caller registry is not silently ignored', async () => {
    const assessment = await assertBoundaryClosed(client, args());
    assert.deepEqual(
      assessment.unknown.filter((code) => code.startsWith('trusted_external_evaluations.')),
      [
        TRUST_BOUNDARY_REASON.CALLER_SUPPLIED_UNTRUSTED,
        TRUST_BOUNDARY_REASON.NO_SERVER_TRUST_POLICY,
      ],
    );
  });

  await test('caller registry remains visibly untrusted when no external evaluation is relevant', async () => {
    const value = args();
    delete value.entry.applicability_conditions;
    const result = await callAssessment(client, value);
    assert.equal(
      result.structuredContent.trust_boundary.classification,
      TRUST_BOUNDARY_CLASSIFICATION.CALLER_SUPPLIED_UNTRUSTED,
    );
    assert.equal(result.structuredContent.trust_boundary.accepted_count, 0);
    assert.deepEqual(result.structuredContent.purpose_assessment.unknown.filter(
      (code) => code.startsWith('trusted_external_evaluations.'),
    ), []);
  });

  await test('absence of the public field adds no trust-boundary noise when irrelevant', async () => {
    const value = args();
    delete value.trusted_external_evaluations;
    delete value.entry.applicability_conditions;
    const result = await callAssessment(client, value);
    assert.deepEqual(result.structuredContent.trust_boundary, {
      boundary_version: TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_VERSION,
      classification: TRUST_BOUNDARY_CLASSIFICATION.NOT_SUPPLIED,
      caller_supplied_count: 0,
      accepted_count: 0,
      reason_codes: [],
    });
    assert.deepEqual(result.structuredContent.purpose_assessment.unknown.filter(
      (code) => code.startsWith('trusted_external_evaluations.'),
    ), []);
  });

  await test('absent public field reports missing server policy only when external trust is required', async () => {
    const value = args();
    delete value.trusted_external_evaluations;
    const result = await callAssessment(client, value);
    assert.deepEqual(result.structuredContent.trust_boundary.reason_codes, [
      TRUST_BOUNDARY_REASON.NO_SERVER_TRUST_POLICY,
    ]);
    assert.equal(result.structuredContent.purpose_assessment.unknown.includes(
      TRUST_BOUNDARY_REASON.NO_SERVER_TRUST_POLICY,
    ), true);
    assert.equal(result.structuredContent.purpose_assessment.unknown.includes(
      TRUST_BOUNDARY_REASON.CALLER_SUPPLIED_UNTRUSTED,
    ), false);
  });
});

console.log(`trusted external evaluation boundary tests: ${passed} passed`);
