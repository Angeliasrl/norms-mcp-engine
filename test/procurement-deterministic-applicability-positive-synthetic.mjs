import {
  CONDITION_BASIS,
  CONDITION_OUTCOME,
  RELIANCE_PURPOSE,
  assessRelianceForPurpose,
} from '../src/model.js';

let pass = 0;
let positiveAssessments = 0;
let negativeAssessments = 0;
const ok = (value, message = 'expected truthy') => {
  if (!value) throw new Error(message);
};
const eq = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};
const t = (name, fn) => {
  fn();
  pass += 1;
  console.log(`  ok    ${name}`);
};

// PROCUREMENT_DETERMINISTIC_APPLICABILITY_POSITIVE_SYNTHETIC_01
// All identifiers and dates below are invented test inputs. They do not model,
// interpret, or establish the applicability of a real legal instrument.
const SYNTHETIC = Object.freeze({
  instrumentId: 'SYNTHETIC_PUBLIC_WORKS_PRICE_LIST_2032',
  provisionId: 'SYNTHETIC_PROVISION_APPLICABILITY_01',
  authorityId: 'SYNTHETIC_AUTHORITY_01',
  scopeId: 'SYNTHETIC_PUBLIC_WORKS_SCOPE_01',
  operationId: 'SYNTHETIC_OPERATION_01',
  conditionId: 'SYNTHETIC_REQUIRED_FACT_01',
  applicableFrom: '2032-01-01',
  applicableUntilExclusive: '2033-01-01',
  evaluationDate: '2032-06-15',
});

const ENTRY_PROOF = {
  date: '2031-12-15',
  document: 'synthetic-positive-entry-proof.json',
  sha256: 'e'.repeat(64),
  section_id: 'synthetic-positive-entry',
};
const COMPLETENESS_PROOF = {
  date: '2031-12-16',
  document: 'synthetic-positive-condition-contract.json',
  sha256: 'f'.repeat(64),
  section_id: 'synthetic-positive-conditions',
  rule_id: 'SYNTHETIC_COMPLETENESS_RULE_01',
  evaluator_id: 'SYNTHETIC_EVALUATOR_01',
  authority_id: SYNTHETIC.authorityId,
};
const SYNTHETIC_EVIDENCE = [{
  type: 'DOCUMENT_REFERENCE',
  reference: 'synthetic-positive-condition-contract.json#synthetic-positive-conditions',
}];
const TRUST = {
  trusted_external_evaluations: [{
    evidence_package_sha256: COMPLETENESS_PROOF.sha256,
    rule_id: COMPLETENESS_PROOF.rule_id,
    evaluator_id: COMPLETENESS_PROOF.evaluator_id,
    authority_id: COMPLETENESS_PROOF.authority_id,
    outcome: CONDITION_OUTCOME.SATISFIED,
  }],
};

const requiredFactCondition = (factValue = true) => ({
  id: SYNTHETIC.conditionId,
  evaluation_mode: 'ENGINE_EVALUATED',
  predicate: {
    operator: 'BOOLEAN_IS',
    left_fact: 'synthetic_required_fact',
    right_value: true,
  },
  facts: { synthetic_required_fact: factValue },
  evidence: [{
    type: 'DOCUMENT_REFERENCE',
    reference: 'synthetic-fact-evidence.json#synthetic-required-fact',
  }],
});
const completeConditions = (condition = requiredFactCondition()) => ({
  completeness: 'COMPLETE',
  completeness_evaluation: {
    mode: 'EXTERNAL_EVALUATION_REQUIRED',
    evaluation: {
      outcome: 'SATISFIED',
      verification_state: 'RATIFIED',
      evidence: SYNTHETIC_EVIDENCE,
      ratification: COMPLETENESS_PROOF,
    },
  },
  conditions: [condition],
});
const positiveEntry = (overrides = {}) => ({
  key: 'SYNTHETIC_POSITIVE_PROCUREMENT_UNIT_01',
  value: 'SYNTHETIC_FREE_TEXT_IGNORED_BY_ENGINE',
  origin: { type: 'SOURCE_DOCUMENT', date: '2031-12-15' },
  verification_state: 'RATIFIED',
  currency: 'CURRENT',
  authority_status: 'VALID',
  expiry_status: 'ACTIVE',
  ratification: ENTRY_PROOF,
  scope: {
    subject: [SYNTHETIC.scopeId],
    jurisdiction: ['SYNTHETIC_JURISDICTION_01'],
    applicable_operations: [SYNTHETIC.operationId],
  },
  effective_interval: {
    from: SYNTHETIC.applicableFrom,
    until_exclusive: SYNTHETIC.applicableUntilExclusive,
  },
  normative_unit: {
    instrument: SYNTHETIC.instrumentId,
    provision: SYNTHETIC.provisionId,
    classification_basis: 'SYNTHETIC_CLASSIFICATION_BASIS_01',
  },
  provision_segmentation: { status: 'SEGMENTED' },
  applicability: {
    from: SYNTHETIC.applicableFrom,
    until_exclusive: SYNTHETIC.applicableUntilExclusive,
  },
  applicability_conditions: completeConditions(),
  ...overrides,
});
const positiveRequest = (entry, overrides = {}) => ({
  entry,
  context: {
    subject: [SYNTHETIC.scopeId],
    jurisdiction: ['SYNTHETIC_JURISDICTION_01'],
    applicable_operations: [SYNTHETIC.operationId],
  },
  reliance_purpose: RELIANCE_PURPOSE.CURRENT_OPERATIONAL,
  as_of: SYNTHETIC.evaluationDate,
  ...overrides,
});
const assess = (entry, requestOverrides = {}) =>
  assessRelianceForPurpose(positiveRequest(entry, requestOverrides), TRUST);
const assertNegative = (name, result) => {
  const assessment = result.purpose_assessment;
  eq(assessment.authorizes_current_operational, false, `${name}: must not authorize`);
  eq(assessment.admissible, false, `${name}: must not be admissible`);
  negativeAssessments += 1;
  return assessment;
};
const unknownCondition = () => ({
  id: SYNTHETIC.conditionId,
  evaluation_mode: 'EXTERNAL_EVALUATION_REQUIRED',
  evaluation: {
    outcome: 'UNKNOWN',
    verification_state: 'UNCONFIRMED',
    evidence: [],
  },
});

console.log('\nprocurement deterministic applicability — positive synthetic 01\n');

t('fully explicit synthetic record authorizes current operational reliance', () => {
  const result = assess(positiveEntry());
  const r = result.purpose_assessment;
  eq(r.authorizes_current_operational, true);
  eq(r.admissible, true);
  eq(r.blocking, []);
  eq(r.unknown, []);
  eq(r.unexamined, false);
  eq(r.eligible, true);
  eq(result.current_operational_ground.eligible, true);
  eq(r.temporal_known, true);
  eq(r.temporal_matches, true);
  eq(r.applicability_known, true);
  eq(r.applicability_matches, true);
  eq(r.conditions_known, true);
  eq(r.conditions_satisfied, true);
  eq(r.condition_completeness_verified, true);
  eq(r.condition_results, [{
    id: SYNTHETIC.conditionId,
    outcome: CONDITION_OUTCOME.SATISFIED,
    basis: CONDITION_BASIS.ENGINE_DERIVED,
  }]);
  eq(r.scope_known, true);
  eq(r.scope_matches, true);
  eq(r.normative_unit_known, true);
  eq(r.provision_identified, true);
  eq(r.segmentation_known, true);
  eq(r.requires_provision_segmentation, false);
  eq(r.instrument_status.authority_status, 'VALID');
  positiveAssessments += 1;

  eq(result, assess(positiveEntry()), 'same explicit input must produce identical output');
});

t('evaluation one day before the synthetic interval fails closed', () => {
  const r = assertNegative('before interval', assess(positiveEntry(), { as_of: '2031-12-31' }));
  eq(r.applicability_matches, false);
  ok(r.blocking.includes('applicability.mismatch'));
});

t('evaluation one day after the synthetic inclusive end fails closed', () => {
  const r = assertNegative('after interval', assess(positiveEntry(), { as_of: '2033-01-01' }));
  eq(r.applicability_matches, false);
  ok(r.blocking.includes('applicability.mismatch'));
});

t('unknown required synthetic fact fails closed', () => {
  const r = assertNegative('unknown fact', assess(positiveEntry({
    applicability_conditions: completeConditions(unknownCondition()),
  })));
  eq(r.conditions_known, false);
  eq(r.conditions_satisfied, false);
  eq(r.condition_results[0].outcome, CONDITION_OUTCOME.UNKNOWN);
  eq(r.condition_results[0].basis, CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED);
});

t('false required synthetic fact fails closed', () => {
  const r = assertNegative('false fact', assess(positiveEntry({
    applicability_conditions: completeConditions(requiredFactCondition(false)),
  })));
  eq(r.conditions_known, true);
  eq(r.conditions_satisfied, false);
  eq(r.condition_results[0].outcome, CONDITION_OUTCOME.NOT_SATISFIED);
  ok(r.blocking.includes('applicability_conditions.not_satisfied'));
});

t('non-matching synthetic scope fails closed', () => {
  const r = assertNegative('scope mismatch', assess(positiveEntry(), {
    context: {
      subject: ['SYNTHETIC_OTHER_SCOPE_01'],
      jurisdiction: ['SYNTHETIC_JURISDICTION_01'],
      applicable_operations: [SYNTHETIC.operationId],
    },
  }));
  eq(r.scope_known, true);
  eq(r.scope_matches, false);
  ok(r.blocking.includes('scope.mismatch'));
});

t('unconfirmed synthetic record fails closed', () => {
  const entry = positiveEntry({ verification_state: 'UNCONFIRMED' });
  delete entry.ratification;
  const r = assertNegative('unconfirmed record', assess(entry));
  eq(r.eligible, false);
  ok(r.blocking.includes('verification.not_ratified'));
});

t('removed synthetic provision fails closed', () => {
  const entry = positiveEntry({ normative_unit: { instrument: SYNTHETIC.instrumentId } });
  const r = assertNegative('missing provision', assess(entry));
  eq(r.provision_identified, false);
  ok(r.unknown.includes('normative_unit.provision_missing'));
});

t('condition moved only to value is not inferred and fails closed', () => {
  const entry = positiveEntry({
    value: 'SYNTHETIC_REQUIRED_FACT_01=true; FREE TEXT MUST NOT BE INTERPRETED',
  });
  delete entry.applicability_conditions;
  const r = assertNegative('free-text-only condition', assess(entry));
  eq(r.conditions_known, false);
  eq(r.conditions_satisfied, false);
  eq(r.condition_results, []);
  ok(r.unknown.includes('applicability_conditions.completeness_unverified'));
  ok(r.unknown.includes('applicability_conditions.unknown'));
});

eq(positiveAssessments, 1, 'exactly one positive assessment is required');
eq(negativeAssessments, 8, 'exactly eight adjacent negative assessments are required');
console.log(`synthetic positive matrix tests: ${pass} passed, ${positiveAssessments} positive assessment, ${negativeAssessments} fail-closed assessments`);
