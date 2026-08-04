import { readFileSync } from 'node:fs';
import {
  CONDITION_BASIS,
  CONDITION_OUTCOME,
  RELIANCE_PURPOSE,
  assessRelianceForPurpose,
} from '../src/model.js';

const fixtureUrl = new URL(
  '../evidence/NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD/fixtures/direct-award-threshold-audit-01.json',
  import.meta.url,
);
const fixture = JSON.parse(readFileSync(fixtureUrl, 'utf8'));
let pass = 0;
let positiveAssessments = 0;
let negativeAssessments = 0;
let rejectedInputs = 0;
const eq = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};
const ok = (value, message = 'expected truthy') => {
  if (!value) throw new Error(message);
};
const t = (name, fn) => {
  fn();
  pass += 1;
  console.log(`  ok    ${name}`);
};
const clone = (value) => structuredClone(value);
const condition = (entry) => entry.applicability_conditions.conditions[0];
const request = (entry, overrides = {}) => ({
  entry,
  context: clone(fixture.context),
  reliance_purpose: RELIANCE_PURPOSE.CURRENT_OPERATIONAL,
  as_of: fixture.evaluation_date,
  ...overrides,
});
const assess = (entry = clone(fixture.entry), overrides = {}) =>
  assessRelianceForPurpose(request(entry, overrides), fixture.trust);
const assertNegative = (name, result) => {
  const r = result.purpose_assessment;
  eq(r.authorizes_current_operational, false, `${name}: authorization`);
  eq(r.admissible, false, `${name}: admissibility`);
  negativeAssessments += 1;
  return r;
};
const setAmount = (entry, amount) => {
  condition(entry).facts.amount_excluding_vat_eur = amount;
  return entry;
};
const setContractType = (entry, contractType) => {
  condition(entry).facts.contract_type = contractType;
  return entry;
};
const unknownAmountEntry = () => {
  const entry = clone(fixture.entry);
  entry.applicability_conditions.conditions = [{
    id: 'art-50-1-b-supply-and-threshold',
    evaluation_mode: 'EXTERNAL_EVALUATION_REQUIRED',
    evaluation: {
      outcome: 'UNKNOWN',
      verification_state: 'UNCONFIRMED',
      evidence: [],
    },
  }];
  return entry;
};

console.log('\nItalian public procurement audit 02 — direct-award threshold\n');

t('real source-derived facts satisfy the limited modeled predicate', () => {
  const first = assess();
  const r = first.purpose_assessment;
  eq(r.authorizes_current_operational, true);
  eq(r.admissible, true);
  eq(r.blocking, []);
  eq(r.unknown, []);
  eq(r.unexamined, false);
  eq(r.applicability_matches, true);
  eq(r.scope_matches, true);
  eq(r.eligible, true);
  eq(r.conditions_satisfied, true);
  eq(r.condition_results, [{
    id: 'art-50-1-b-supply-and-threshold',
    outcome: CONDITION_OUTCOME.SATISFIED,
    basis: CONDITION_BASIS.ENGINE_DERIVED,
  }]);
  eq(first.current_operational_ground.eligible, true);
  eq(first, assess(), 'same frozen input must be structurally deterministic');
  positiveAssessments += 1;
});

t('EUR 139999.99 supply remains inside the strict threshold', () => {
  const r = assess(setAmount(clone(fixture.entry), 139999.99)).purpose_assessment;
  eq(r.authorizes_current_operational, true);
  eq(r.conditions_satisfied, true);
  positiveAssessments += 1;
});

t('EUR 140000.00 is outside the strict threshold', () => {
  const r = assertNegative('equal threshold', assess(setAmount(clone(fixture.entry), 140000)));
  eq(r.conditions_satisfied, false);
  ok(r.blocking.includes('applicability_conditions.not_satisfied'));
});

t('EUR 140000.01 is outside the strict threshold', () => {
  const r = assertNegative('above threshold', assess(setAmount(clone(fixture.entry), 140000.01)));
  eq(r.conditions_satisfied, false);
});

t('WORKS does not match the selected supply/service branch', () => {
  const r = assertNegative('works', assess(setContractType(clone(fixture.entry), 'WORKS')));
  eq(r.conditions_satisfied, false);
});

t('unknown amount fails closed', () => {
  const r = assertNegative('unknown amount', assess(unknownAmountEntry()));
  eq(r.conditions_known, false);
  eq(r.condition_results[0].outcome, CONDITION_OUTCOME.UNKNOWN);
  ok(r.unknown.includes('applicability_conditions.unknown'));
});

t('absent amount is rejected by the canonical predicate API', () => {
  const entry = clone(fixture.entry);
  delete condition(entry).facts.amount_excluding_vat_eur;
  try {
    assess(entry);
    throw new Error('missing amount must not yield an assessment');
  } catch (error) {
    eq(error.code, 'CONDITION_FACT_MISSING');
    rejectedInputs += 1;
  }
});

t('amount placed only in free text is not inferred', () => {
  const entry = clone(fixture.entry);
  delete condition(entry).facts.amount_excluding_vat_eur;
  entry.value = 'amount_excluding_vat_eur=12816; FREE TEXT MUST BE IGNORED';
  try {
    assess(entry);
    throw new Error('free-text amount must not yield an assessment');
  } catch (error) {
    eq(error.code, 'CONDITION_FACT_MISSING');
    rejectedInputs += 1;
  }
});

t('removed selected provision fails closed', () => {
  const entry = clone(fixture.entry);
  delete entry.normative_unit.provision;
  const r = assertNegative('missing provision', assess(entry));
  ok(r.unknown.includes('normative_unit.provision_missing'));
});

t('unratified normative unit fails closed', () => {
  const entry = clone(fixture.entry);
  entry.verification_state = 'UNCONFIRMED';
  delete entry.ratification;
  const r = assertNegative('unratified unit', assess(entry));
  ok(r.blocking.includes('verification.not_ratified'));
});

t('date before the historical applicability interval fails closed', () => {
  const r = assertNegative('outside historical interval', assess(clone(fixture.entry), {
    as_of: '2023-06-30',
  }));
  eq(r.applicability_matches, false);
  ok(r.blocking.includes('applicability.mismatch'));
});

eq(positiveAssessments, 2, 'real case and one threshold boundary must be positive');
eq(negativeAssessments, 7, 'seven assessed boundary cases must fail closed');
eq(rejectedInputs, 2, 'two malformed fact inputs must be rejected');
console.log(`audit 02 tests: ${pass} passed, ${positiveAssessments} positive, ${negativeAssessments} fail-closed, ${rejectedInputs} rejected`);
