import {
  CONDITION_BASIS, CONDITION_COMPLETENESS, CONDITION_EVALUATION_MODE,
  CONDITION_OUTCOME, PREDICATE_OPERATOR, RELIANCE_PURPOSE,
  assessRelianceForPurpose as assessRelianceForPurposeRaw, evaluateConditionPredicate,
} from '../src/model.js';

let pass = 0;
const ok = (v, m = 'expected truthy') => { if (!v) throw new Error(m); };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m || `${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const throws = (fn, code) => { try { fn(); } catch (e) { if (e.code === code) return; throw e; } throw new Error(`expected ${code}`); };
const t = (name, fn) => { fn(); pass += 1; console.log(`  ok    ${name}`); };

const proof = {
  date: '2026-08-03', document: 'evidence-package.json', sha256: 'a'.repeat(64),
  section_id: 'conditions', rule_id: 'rule-1', evaluator_id: 'authority-evaluator',
  authority_id: 'official-authority',
};
const evidence = [{ type: 'DOCUMENT_REFERENCE', reference: 'evidence-package.json#conditions' }];
const completeness = {
  mode: 'EXTERNAL_EVALUATION_REQUIRED',
  evaluation: {
    outcome: 'SATISFIED', verification_state: 'RATIFIED', evidence, ratification: proof,
  },
};
const baseEntry = (conditions) => ({
  key: 'BOUNDARY_CASE', value: null, origin: { type: 'SOURCE_DOCUMENT', date: '2026-08-03' },
  verification_state: 'RATIFIED', currency: 'CURRENT', authority_status: 'VALID',
  expiry_status: 'ACTIVE', ratification: { date: '2026-08-03', document: 'source.json', sha256: 'b'.repeat(64), section_id: 'unit' },
  scope: { jurisdiction: 'EU', applicable_operations: 'assessment' },
  effective_interval: { from: '2025-01-01' }, applicability: { from: '2025-01-01' },
  normative_unit: { instrument: 'Synthetic instrument', provision: 'unit-1' },
  provision_segmentation: { status: 'SEGMENTED' },
  applicability_conditions: {
    completeness: 'COMPLETE', completeness_evaluation: completeness, conditions,
  },
});
const request = (entry) => ({
  entry, context: { jurisdiction: 'EU', applicable_operations: 'assessment' },
  reliance_purpose: RELIANCE_PURPOSE.CURRENT_OPERATIONAL, as_of: '2026-08-03',
});
const derived = (id, predicate, facts) => ({ id, evaluation_mode: 'ENGINE_EVALUATED', predicate, facts, evidence: [] });
const external = (over = {}) => ({ id: 'external', evaluation_mode: 'EXTERNAL_EVALUATION_REQUIRED', evaluation: {
  outcome: 'SATISFIED', verification_state: 'RATIFIED', evidence, ratification: proof, ...over,
}});
const trust = {
  trusted_external_evaluations: [{
    evidence_package_sha256: proof.sha256, rule_id: proof.rule_id,
    evaluator_id: proof.evaluator_id, authority_id: proof.authority_id,
    outcome: 'SATISFIED',
  }],
};
const assessRelianceForPurpose = (value) => assessRelianceForPurposeRaw(value, trust);

t('P0 caller status assertion is rejected', () => {
  throws(() => assessRelianceForPurpose(request({ ...baseEntry([]), applicability_conditions: { status: 'SATISFIED', evidence } })), 'PURPOSE_CONDITIONS_LEGACY_STATUS_FORBIDDEN');
});
t('numeric threshold is engine-derived without coercion', () => {
  const r = assessRelianceForPurpose(request(baseEntry([derived('threshold', { operator: 'NUM_GTE', left_fact: 'amount', right_value: 100 }, { amount: 101 })]))).purpose_assessment;
  ok(r.authorizes_current_operational); eq(r.condition_results[0].basis, CONDITION_BASIS.ENGINE_DERIVED);
});
t('application date before boundary fails', () => {
  const r = assessRelianceForPurpose(request(baseEntry([derived('date', { operator: 'DATE_ON_OR_AFTER', left_fact: 'placed', right_value: '2026-09-12' }, { placed: '2026-09-11' })]))).purpose_assessment;
  eq(r.authorizes_current_operational, false); eq(r.condition_results[0].outcome, CONDITION_OUTCOME.NOT_SATISFIED);
});
t('administrative designation can be externally ratified', () => {
  ok(assessRelianceForPurpose(request(baseEntry([external()]))).purpose_assessment.authorizes_current_operational);
});
t('forged caller ratification is untrusted by default', () => {
  const r = assessRelianceForPurposeRaw(request(baseEntry([external()])))
    .purpose_assessment;
  eq(r.authorizes_current_operational, false);
  eq(r.condition_results[0].basis, CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED);
  eq(r.condition_completeness_result.basis, CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED);
  eq(r.external_evaluation_required, true);
});
t('untrusted completeness alone remains visible and requires external evaluation', () => {
  const r = assessRelianceForPurposeRaw(request(baseEntry([]))).purpose_assessment;
  eq(r.condition_completeness_verified, false);
  eq(r.condition_completeness_result.basis, CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED);
  eq(r.external_evaluation_required, true);
  eq(r.authorizes_current_operational, false);
});
t('trusted registry binds digest, rule, evaluator, authority, and outcome', () => {
  const wrong = { trusted_external_evaluations: [{ ...trust.trusted_external_evaluations[0], evaluator_id: 'other' }] };
  eq(assessRelianceForPurposeRaw(request(baseEntry([external()])), wrong).purpose_assessment.authorizes_current_operational, false);
});
t('ALL ANY NOT composition is deterministic', () => {
  const predicate = { operator: 'ALL', operands: [
    { operator: 'BOOLEAN_IS', left_fact: 'designated', right_value: true },
    { operator: 'NOT', operand: { operator: 'EQ', left_fact: 'state', right_value: 'barred' } },
  ]};
  ok(evaluateConditionPredicate(predicate, { designated: true, state: 'active' }).value);
});
t('equality, inequality and set membership are typed', () => {
  ok(evaluateConditionPredicate({ operator: 'EQ', left_fact: 'kind', right_value: 'service' }, { kind: 'service' }).value);
  ok(evaluateConditionPredicate({ operator: 'NEQ', left_fact: 'kind', right_value: 'goods' }, { kind: 'service' }).value);
  ok(evaluateConditionPredicate({ operator: 'IN', left_fact: 'kind', right_values: ['goods', 'service'] }, { kind: 'service' }).value);
  ok(evaluateConditionPredicate({ operator: 'NOT_IN', left_fact: 'kind', right_values: ['works'] }, { kind: 'service' }).value);
  throws(() => evaluateConditionPredicate({ operator: 'EQ', left_fact: 'amount', right_value: '100' }, { amount: 100 }), 'CONDITION_TYPE_MISMATCH');
});
t('civil-date interval is start-inclusive and end-exclusive', () => {
  const p = { operator: 'IN_INTERVAL', left_fact: 'date', from: '2026-01-01', until_exclusive: '2027-01-01' };
  ok(evaluateConditionPredicate(p, { date: '2026-01-01' }).value);
  eq(evaluateConditionPredicate(p, { date: '2027-01-01' }).value, false);
});
t('predicate depth and condition count are bounded', () => {
  let p = { operator: 'BOOLEAN_IS', left_fact: 'x', right_value: true };
  for (let i = 0; i < 8; i += 1) p = { operator: 'NOT', operand: p };
  throws(() => evaluateConditionPredicate(p, { x: true }), 'CONDITION_PREDICATE_LIMIT');
  const e = baseEntry(Array.from({ length: 33 }, (_, i) => derived(String(i), { operator: 'BOOLEAN_IS', left_fact: 'x', right_value: true }, { x: true })));
  throws(() => assessRelianceForPurpose(request(e)), 'PURPOSE_CONDITIONS_LIMIT');
});
t('condition identifiers, fact keys, and evidence counts are bounded', () => {
  const long = 'x'.repeat(129);
  throws(() => assessRelianceForPurpose(request(baseEntry([derived(long, { operator: 'BOOLEAN_IS', left_fact: 'x', right_value: true }, { x: true })]))), 'CONDITION_ID_INVALID');
  throws(() => evaluateConditionPredicate({ operator: 'BOOLEAN_IS', left_fact: long, right_value: true }, { [long]: true }), 'CONDITION_FACT_KEY_INVALID');
  const tooMuchEvidence = Array.from({ length: 33 }, (_, i) => ({ type: 'DOCUMENT_REFERENCE', reference: String(i) }));
  throws(() => assessRelianceForPurpose(request(baseEntry([{ ...external(), evaluation: { ...external().evaluation, evidence: tooMuchEvidence } }]))), 'CONDITION_EVIDENCE_LIMIT');
});
t('unknown completeness fails closed', () => {
  const e = baseEntry([]); e.applicability_conditions.completeness = CONDITION_COMPLETENESS.UNKNOWN;
  eq(assessRelianceForPurpose(request(e)).purpose_assessment.authorizes_current_operational, false);
});
t('unsupported condition fails closed', () => {
  const c = { id: 'judgment', evaluation_mode: 'EXTERNAL_EVALUATION_REQUIRED', evaluation: { outcome: 'UNKNOWN', verification_state: 'UNCONFIRMED', evidence: [] } };
  const r = assessRelianceForPurpose(request(baseEntry([c]))).purpose_assessment;
  eq(r.authorizes_current_operational, false); eq(r.condition_results[0].basis, CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED);
});
t('unratified external evaluation never authorizes', () => {
  const r = assessRelianceForPurpose(request(baseEntry([external({ verification_state: 'UNCONFIRMED', evidence: [], ratification: undefined })]))).purpose_assessment;
  eq(r.authorizes_current_operational, false);
});
t('missing external proof is rejected', () => {
  throws(() => assessRelianceForPurpose(request(baseEntry([external({ evidence: [], ratification: undefined })]))), 'EXTERNAL_EVALUATION_EVIDENCE_REQUIRED');
});
t('invalid external digest is rejected', () => {
  throws(() => assessRelianceForPurpose(request(baseEntry([external({ ratification: { ...proof, sha256: 'bad' } })]))), 'EXTERNAL_EVALUATION_BAD_DIGEST');
});
t('old audit class cannot override engine-derived false predicate', () => {
  for (const facts of [{ allowed: false }, { rotation_exception: false }, { exception_present: false }]) {
    const name = Object.keys(facts)[0];
    const c = derived(name, { operator: 'BOOLEAN_IS', left_fact: name, right_value: true }, facts);
    eq(assessRelianceForPurpose(request(baseEntry([c]))).purpose_assessment.authorizes_current_operational, false);
  }
});

console.log(`condition evidence tests: ${pass} passed`);
