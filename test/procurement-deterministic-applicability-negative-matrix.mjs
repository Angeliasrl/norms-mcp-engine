import {
  CONDITION_BASIS,
  CONDITION_OUTCOME,
  RELIANCE_PURPOSE,
  assessRelianceForPurpose,
} from '../src/model.js';

let pass = 0;
const assessments = [];
const rejections = [];
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

// PROCUREMENT_DETERMINISTIC_APPLICABILITY_NEGATIVE_MATRIX_01
//
// This is deliberately a synthetic gate fixture. Its dates and identifiers are
// test inputs, not statements about any real procurement instrument. In
// particular it does not define ORDINARY_FROM, select between temporal regimes,
// or declare the completeness of any real legal rule.
const ENTRY_PROOF = {
  date: '2026-08-03',
  document: 'synthetic-procurement-gate-fixture.json',
  sha256: 'c'.repeat(64),
  section_id: 'synthetic-unit',
};
const CONDITION_PROOF = {
  date: '2026-08-03',
  document: 'synthetic-condition-contract.json',
  sha256: 'd'.repeat(64),
  section_id: 'synthetic-conditions',
  rule_id: 'synthetic-completeness-rule',
  evaluator_id: 'synthetic-evaluator',
  authority_id: 'synthetic-authority',
};
const CONDITION_EVIDENCE = [{
  type: 'DOCUMENT_REFERENCE',
  reference: 'synthetic-condition-contract.json#synthetic-conditions',
}];
const TRUST = {
  trusted_external_evaluations: [{
    evidence_package_sha256: CONDITION_PROOF.sha256,
    rule_id: CONDITION_PROOF.rule_id,
    evaluator_id: CONDITION_PROOF.evaluator_id,
    authority_id: CONDITION_PROOF.authority_id,
    outcome: CONDITION_OUTCOME.SATISFIED,
  }],
};
const verifiedCompleteness = () => ({
  completeness: 'COMPLETE',
  completeness_evaluation: {
    mode: 'EXTERNAL_EVALUATION_REQUIRED',
    evaluation: {
      outcome: 'SATISFIED',
      verification_state: 'RATIFIED',
      evidence: CONDITION_EVIDENCE,
      ratification: CONDITION_PROOF,
    },
  },
  conditions: [],
});
const syntheticEntry = (overrides = {}) => ({
  key: 'SYNTHETIC_PROCUREMENT_APPLICABILITY_UNIT',
  value: 'Synthetic marker only. The engine must not interpret this text.',
  origin: { type: 'SOURCE_DOCUMENT', date: '2026-08-03' },
  verification_state: 'RATIFIED',
  currency: 'CURRENT',
  authority_status: 'VALID',
  expiry_status: 'ACTIVE',
  ratification: ENTRY_PROOF,
  scope: {
    jurisdiction: ['SYNTHETIC_JURISDICTION'],
    applicable_operations: ['SYNTHETIC_PROCUREMENT_ASSESSMENT'],
  },
  effective_interval: { from: '2025-01-01' },
  normative_unit: {
    instrument: 'Synthetic procurement instrument',
    provision: 'Synthetic applicability unit',
  },
  provision_segmentation: { status: 'SEGMENTED' },
  applicability: { from: '2026-01-01', until_exclusive: '2027-01-01' },
  applicability_conditions: verifiedCompleteness(),
  ...overrides,
});
const request = (entry, overrides = {}) => ({
  entry,
  context: {
    jurisdiction: ['SYNTHETIC_JURISDICTION'],
    applicable_operations: ['SYNTHETIC_PROCUREMENT_ASSESSMENT'],
  },
  reliance_purpose: RELIANCE_PURPOSE.CURRENT_OPERATIONAL,
  as_of: '2026-08-03',
  ...overrides,
});
const assessNegative = (name, entry, requestOverrides = {}) => {
  const result = assessRelianceForPurpose(request(entry, requestOverrides), TRUST).purpose_assessment;
  eq(result.authorizes_current_operational, false, `${name}: current authorization must fail closed`);
  eq(result.admissible, false, `${name}: current operational admission must fail closed`);
  eq(
    result.unexamined,
    result.blocking.length === 0 && result.unknown.length > 0,
    `${name}: unexamined must agree with blocking and unknown`,
  );
  assessments.push({ name, result });
  return result;
};
const unconfirmedCondition = (outcome) => ({
  id: 'project-approval-date-required',
  evaluation_mode: 'EXTERNAL_EVALUATION_REQUIRED',
  evaluation: {
    outcome,
    verification_state: 'UNCONFIRMED',
    evidence: [],
  },
});

console.log('\nprocurement deterministic applicability — negative matrix 01\n');

t('1 whole instrument requiring segmentation fails closed', () => {
  const entry = syntheticEntry({
    normative_unit: { instrument: 'Synthetic procurement instrument' },
    provision_segmentation: { status: 'REQUIRED' },
  });
  const r = assessNegative('non-segmented instrument', entry);
  ok(r.blocking.includes('provision_segmentation.required'));
  ok(r.unknown.includes('normative_unit.provision_missing'));
  eq(r.unexamined, false);
});

t('2 unidentified provision fails closed as unknown', () => {
  const r = assessNegative('unidentified provision', syntheticEntry({
    normative_unit: { instrument: 'Synthetic procurement instrument' },
  }));
  eq(r.blocking, []);
  ok(r.unknown.includes('normative_unit.provision_missing'));
  eq(r.unexamined, true);
});

t('3 missing provision applicability interval fails closed', () => {
  const entry = syntheticEntry();
  delete entry.applicability;
  const r = assessNegative('missing applicability', entry);
  eq(r.applicability_known, false);
  ok(r.unknown.includes('applicability.missing'));
});

t('4 date before declared synthetic interval fails closed', () => {
  const r = assessNegative('before applicability', syntheticEntry(), { as_of: '2025-12-31' });
  eq(r.applicability_matches, false);
  ok(r.blocking.includes('applicability.mismatch'));
});

t('5 date after declared synthetic interval fails closed', () => {
  const r = assessNegative('after applicability', syntheticEntry(), { as_of: '2027-01-01' });
  eq(r.applicability_matches, false);
  ok(r.blocking.includes('applicability.mismatch'));
});

t('6 required but unverified applicability condition fails closed', () => {
  const conditions = verifiedCompleteness();
  conditions.conditions = [unconfirmedCondition(CONDITION_OUTCOME.SATISFIED)];
  const r = assessNegative('unverified required condition', syntheticEntry({ applicability_conditions: conditions }));
  eq(r.conditions_known, false);
  eq(r.condition_results[0].basis, CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED);
  ok(r.unknown.includes('applicability_conditions.unknown'));
});

t('7 absent atomic fact is rejected and unknown fact fails closed', () => {
  const absent = verifiedCompleteness();
  absent.conditions = [{
    id: 'project-approval-date',
    evaluation_mode: 'ENGINE_EVALUATED',
    predicate: {
      operator: 'DATE_ON_OR_BEFORE',
      left_fact: 'project_approval_date',
      right_value: '2026-06-30',
    },
    facts: {},
    evidence: [],
  }];
  try {
    assessRelianceForPurpose(request(syntheticEntry({ applicability_conditions: absent })), TRUST);
    throw new Error('absent atomic fact must not yield an assessment');
  } catch (error) {
    eq(error.code, 'CONDITION_FACT_MISSING');
    rejections.push({ name: 'absent atomic fact', code: error.code });
  }

  const unknown = verifiedCompleteness();
  unknown.conditions = [unconfirmedCondition(CONDITION_OUTCOME.UNKNOWN)];
  const r = assessNegative('unknown atomic fact', syntheticEntry({ applicability_conditions: unknown }));
  eq(r.conditions_known, false);
  eq(r.conditions_satisfied, false);
  eq(r.condition_results[0].outcome, CONDITION_OUTCOME.UNKNOWN);
});

t('8 condition present only in free text is never inferred', () => {
  const entry = syntheticEntry({
    value: 'Use is conditional on a project approval date. This text is not interpreted.',
  });
  delete entry.applicability_conditions;
  const r = assessNegative('free-text-only condition', entry);
  eq(r.conditions_known, false);
  eq(r.condition_results, []);
  ok(r.unknown.includes('applicability_conditions.completeness_unverified'));
  ok(r.unknown.includes('applicability_conditions.unknown'));
});

t('9 unknown authority fails closed without becoming an adverse finding', () => {
  const r = assessNegative('unknown authority', syntheticEntry({ authority_status: 'UNKNOWN' }));
  eq(r.blocking, []);
  ok(r.unknown.includes('authority.unknown'));
  eq(r.unexamined, true);
});

t('10 missing or unknown scope fails closed', () => {
  const missing = syntheticEntry();
  delete missing.scope;
  const missingResult = assessNegative('missing scope', missing);
  eq(missingResult.scope_known, false);
  ok(missingResult.unknown.includes('scope.missing'));

  const unknownResult = assessNegative('unknown scope context', syntheticEntry(), {
    context: { jurisdiction: ['SYNTHETIC_JURISDICTION'] },
  });
  eq(unknownResult.scope_known, false);
  eq(unknownResult.scope_matches, null);
  ok(unknownResult.unknown.includes('scope.missing'));
});

t('11 unconfirmed record fails closed', () => {
  const entry = syntheticEntry({ verification_state: 'UNCONFIRMED' });
  delete entry.ratification;
  const r = assessNegative('unconfirmed record', entry);
  ok(r.blocking.includes('verification.not_ratified'));
  eq(r.eligible, false);
});

t('12 missing or false current-ground eligibility fails closed', () => {
  const missing = syntheticEntry();
  delete missing.currency;
  const missingResult = assessNegative('missing current-ground eligibility', missing);
  ok(missingResult.unknown.includes('current_status.currency_unknown'));
  eq(missingResult.eligible, false);

  const falseResult = assessNegative('false current-ground eligibility', syntheticEntry({ currency: 'STALE' }));
  ok(falseResult.blocking.includes('current_status.currency_stale'));
  eq(falseResult.eligible, false);
});

t('13 an empty blocker list never implies current authorization', () => {
  const entry = syntheticEntry();
  delete entry.provision_segmentation;
  const r = assessNegative('empty blocker list with unknown gate', entry);
  eq(r.blocking, []);
  ok(r.unknown.includes('provision_segmentation.unknown'));
  eq(r.unexamined, true);
  eq(r.authorizes_current_operational, false);
});

t('matrix contains no positive assessment and is deterministic', () => {
  ok(assessments.length >= 13);
  ok(assessments.every(({ result }) => result.authorizes_current_operational === false));
  ok(assessments.every(({ result }) => result.admissible === false));
  eq(rejections, [{ name: 'absent atomic fact', code: 'CONDITION_FACT_MISSING' }]);

  const entry = syntheticEntry();
  delete entry.applicability;
  eq(
    assessRelianceForPurpose(request(entry), TRUST),
    assessRelianceForPurpose(request(entry), TRUST),
  );
});

console.log(`procurement negative matrix tests: ${pass} passed, ${assessments.length} fail-closed assessments, ${rejections.length} rejected input`);
