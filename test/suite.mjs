import {
  ORIGIN, VERIFICATION, CURRENCY, AUTHORITY, EXPIRY, EXPIRY_POLICY,
  validateEntry, eligibleAsGround, admissibleFor, revalidate, evaluateExpiry,
  RELIANCE_PURPOSE, APPLICABILITY_CONDITION_STATUS, PROVISION_SEGMENTATION_STATUS,
  isValidCivilDate, validateEffectiveInterval, validateApplicability,
  validateApplicabilityConditions, validateProvisionSegmentation,
  assessRelianceForPurpose as assessRelianceForPurposeRaw,
} from '../src/model.js';
import {
  byteLength, canonicaliseContent, canonicalBytes, corpusDigest,
  documentDigest, buildIndex, detectDrift, normaliseDocuments, CorpusError,
} from '../src/canonical.js';
import { lintClaimMap, STATE, EVIDENCE_CLASS, parseMarkdownClaims } from '../src/claimmap.js';
import { claims as ownClaims } from '../claims.mjs';
import { renderClaimMap } from '../scripts/build-claimmap.mjs';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
};
const eq = (a, b, m = '') => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${m} expected ${B}, got ${A}`);
};
const ok = (v, m = '') => { if (!v) throw new Error(m || 'expected truthy'); };
const throws = (fn, code) => {
  try { fn(); } catch (e) { if (code && e.code !== code) throw new Error(`expected ${code}, got ${e.code}`); return; }
  throw new Error(`expected throw${code ? ` ${code}` : ''}`);
};

const RATIFIED_PROOF = {
  date: '2026-07-31',
  document: 'POLICY.md',
  sha256: '7323dd5f'.padEnd(64, '0'),
  section_id: 'sec-4-2',
};
const PURPOSE_TRUST = {
  trusted_external_evaluations: [{
    evidence_package_sha256: RATIFIED_PROOF.sha256,
    rule_id: 'synthetic-rule',
    evaluator_id: 'synthetic-evaluator',
    authority_id: 'synthetic-authority',
    outcome: 'SATISFIED',
  }],
};
const assessRelianceForPurpose = (request) =>
  assessRelianceForPurposeRaw(request, PURPOSE_TRUST);

const base = (over = {}) => ({
  key: 'RETENTION_WINDOW',
  value: 'P30D',
  origin: { type: ORIGIN.SOURCE_DOCUMENT, date: '2026-07-31' },
  verification_state: VERIFICATION.RATIFIED,
  currency: CURRENCY.CURRENT,
  authority_status: AUTHORITY.VALID,
  expiry_status: EXPIRY.ACTIVE,
  ratification: RATIFIED_PROOF,
  ...over,
});

console.log('\nnorms-mcp — model\n');

t('all four origin × verification cells are representable', () => {
  const cells = [
    [ORIGIN.SOURCE_DOCUMENT,   VERIFICATION.UNCONFIRMED],
    [ORIGIN.SOURCE_DOCUMENT,   VERIFICATION.RATIFIED],
    [ORIGIN.OWNER_DECLARATION, VERIFICATION.UNCONFIRMED],
    [ORIGIN.OWNER_DECLARATION, VERIFICATION.RATIFIED],
  ];
  for (const [o, v] of cells) {
    const e = base({ origin: { type: o }, verification_state: v });
    if (v === VERIFICATION.UNCONFIRMED) delete e.ratification;
    ok(validateEntry(e));
  }
});

t('origin survives ratification — a declared constant stays declared', () => {
  const e = base({ origin: { type: ORIGIN.OWNER_DECLARATION }, verification_state: VERIFICATION.RATIFIED });
  ok(validateEntry(e));
  eq(e.origin.type, ORIGIN.OWNER_DECLARATION);
  ok(eligibleAsGround(e).eligible);
});

t('RATIFIED without a ratification block is rejected', () => {
  const e = base(); delete e.ratification;
  throws(() => validateEntry(e), 'RATIFIED_WITHOUT_PROOF');
});

t('ratification with a short digest is rejected', () => {
  throws(() => validateEntry(base({ ratification: { ...RATIFIED_PROOF, sha256: 'abc' } })), 'RATIFICATION_BAD_DIGEST');
});

t('ratification missing section_id is rejected', () => {
  const r = { ...RATIFIED_PROOF }; delete r.section_id;
  throws(() => validateEntry(base({ ratification: r })), 'RATIFICATION_INCOMPLETE');
});

t('a fully qualified ratified entry is eligible', () => {
  const v = eligibleAsGround(base());
  ok(v.eligible); eq(v.blocking, []); eq(v.unknown, []);
});

t('UNKNOWN fails closed but is not a finding against the entry', () => {
  const v = eligibleAsGround(base({ authority_status: AUTHORITY.UNKNOWN }));
  ok(!v.eligible, 'must not be eligible');
  eq(v.blocking, [], 'nothing was found wanting');
  eq(v.unknown, ['authority_status']);
  ok(v.unexamined, 'must be flagged unexamined, not invalid');
});

t('INVALID and UNKNOWN are not conflated', () => {
  const inv = eligibleAsGround(base({ authority_status: AUTHORITY.INVALID }));
  const unk = eligibleAsGround(base({ authority_status: AUTHORITY.UNKNOWN }));
  ok(!inv.eligible && !unk.eligible);
  ok(inv.blocking.length === 1 && inv.unknown.length === 0);
  ok(unk.blocking.length === 0 && unk.unknown.length === 1);
  ok(inv.unexamined === false && unk.unexamined === true);
});

t('STALE currency blocks eligibility', () => {
  const v = eligibleAsGround(base({ currency: CURRENCY.STALE }));
  ok(!v.eligible); ok(v.blocking.includes('currency is STALE'));
});

t('REVIEW_DUE blocks eligibility', () => {
  ok(!eligibleAsGround(base({ expiry_status: EXPIRY.REVIEW_DUE })).eligible);
});

t('defaults are UNKNOWN, so an underspecified entry is never eligible', () => {
  const e = { key: 'X', origin: { type: ORIGIN.SOURCE_DOCUMENT }, verification_state: VERIFICATION.RATIFIED, ratification: RATIFIED_PROOF };
  const v = eligibleAsGround(e);
  ok(!v.eligible);
  eq(v.unknown.sort(), ['authority_status', 'currency', 'expiry_status']);
});

console.log('\nnorms-mcp — applicability\n');

t('eligibility does not imply applicability', () => {
  const e = base();
  const a = admissibleFor(e, { subject: 'anything' });
  ok(a.eligible, 'eligible'); ok(!a.admissible, 'not admissible without scope');
  eq(a.scope_known, false);
});

t('declared scope matching the context yields admissible', () => {
  const e = base({ scope: { subject: ['android'], applicable_operations: ['deploy'] } });
  const a = admissibleFor(e, { subject: 'android', applicable_operations: 'deploy' });
  ok(a.admissible);
});

t('declared scope not matching yields not admissible while still eligible', () => {
  const e = base({ scope: { subject: ['android'] } });
  const a = admissibleFor(e, { subject: 'ios' });
  ok(a.eligible); ok(!a.admissible); eq(a.scope_matches, false);
});

t('declared dimension with no answer in context does not match', () => {
  const e = base({ scope: { jurisdiction: ['IT'] } });
  ok(!admissibleFor(e, {}).admissible);
});

console.log('\nnorms-mcp — temporal purpose and provision applicability\n');

const temporalBase = (over = {}) => base({
  key: 'SYNTHETIC_PROVISION',
  value: 'Synthetic provision marker; not interpreted by the engine.',
  scope: {
    subject: ['HIGH_RISK_AI_SYSTEM'],
    jurisdiction: ['EU'],
    applicable_operations: ['COMPLIANCE_ASSESSMENT'],
  },
  effective_interval: { from: '2024-08-01' },
  normative_unit: {
    instrument: 'Synthetic Regulation 2024/0001',
    provision: 'Chapter III, synthetic unit',
    classification_basis: 'Synthetic classification basis',
  },
  applicability: { from: '2025-02-02' },
  applicability_conditions: {
    completeness: 'COMPLETE',
    completeness_evaluation: {
      mode: 'EXTERNAL_EVALUATION_REQUIRED',
      evaluation: {
        outcome: 'SATISFIED',
        verification_state: 'RATIFIED',
        evidence: [{ type: 'DOCUMENT_REFERENCE', reference: 'synthetic applicability contract' }],
        ratification: {
          ...RATIFIED_PROOF,
          rule_id: 'synthetic-rule',
          evaluator_id: 'synthetic-evaluator',
          authority_id: 'synthetic-authority',
        },
      },
    },
    conditions: [],
  },
  provision_segmentation: {
    status: PROVISION_SEGMENTATION_STATUS.SEGMENTED,
  },
  ...over,
});

const currentRequest = (entry, over = {}) => ({
  entry,
  context: {
    subject: ['HIGH_RISK_AI_SYSTEM'],
    jurisdiction: ['EU'],
    applicable_operations: ['COMPLIANCE_ASSESSMENT'],
  },
  reliance_purpose: RELIANCE_PURPOSE.CURRENT_OPERATIONAL,
  as_of: '2026-08-03',
  ...over,
});

t('strict civil date parser accepts dates and rejects timestamps or normalised dates', () => {
  ok(isValidCivilDate('2026-08-03'));
  ok(!isValidCivilDate('2026-08-03T00:00:00Z'));
  ok(!isValidCivilDate('2026-02-30'));
});

t('effective and applicability intervals reject inverted bounds', () => {
  throws(
    () => validateEffectiveInterval({ from: '2026-01-02', until_exclusive: '2026-01-01' }),
    'EFFECTIVE_INTERVAL_ORDER_INVALID'
  );
  throws(
    () => validateApplicability({ from: '2026-01-02', until_exclusive: '2026-01-01' }),
    'APPLICABILITY_ORDER_INVALID'
  );
});

t('provision applicable since 2025 passes current operational in 2026', () => {
  const r = assessRelianceForPurpose(currentRequest(temporalBase())).purpose_assessment;
  ok(r.admissible);
  ok(r.authorizes_current_operational);
  eq(r.applicability_known, true);
  eq(r.applicability_matches, true);
  eq(r.requires_provision_segmentation, false);
});

t('same current instrument with a provision applicable only in 2028 fails in 2026', () => {
  const entry = temporalBase({ applicability: { from: '2028-08-02' } });
  const r = assessRelianceForPurpose(currentRequest(entry)).purpose_assessment;
  eq(r.admissible, false);
  eq(r.applicability_known, true);
  eq(r.applicability_matches, false);
  eq(r.authorizes_current_operational, false);
  ok(r.blocking.includes('applicability.mismatch'));
});

t('whole staggered instrument fails closed until provision segmentation', () => {
  const entry = temporalBase({
    normative_unit: { instrument: 'Synthetic Regulation 2024/0001' },
    provision_segmentation: { status: PROVISION_SEGMENTATION_STATUS.REQUIRED },
  });
  const r = assessRelianceForPurpose(currentRequest(entry)).purpose_assessment;
  eq(r.requires_provision_segmentation, true);
  eq(r.admissible, false);
  eq(r.authorizes_current_operational, false);
});

t('current operational without applicability is the explicit P0 regression', () => {
  const entry = temporalBase(); delete entry.applicability;
  const r = assessRelianceForPurpose(currentRequest(entry)).purpose_assessment;
  eq(r.applicability_known, false);
  eq(r.admissible, false);
  eq(r.authorizes_current_operational, false);
});

t('verified completeness and engine-derived true condition can proceed', () => {
  const none = assessRelianceForPurpose(currentRequest(temporalBase())).purpose_assessment;
  ok(none.conditions_known && none.conditions_satisfied && none.admissible);
  const satisfied = temporalBase({
    applicability_conditions: {
      ...temporalBase().applicability_conditions,
      conditions: [{
        id: 'synthetic-boolean',
        evaluation_mode: 'ENGINE_EVALUATED',
        predicate: { operator: 'BOOLEAN_IS', left_fact: 'applies', right_value: true },
        facts: { applies: true },
        evidence: [],
      }],
    },
  });
  const r = assessRelianceForPurpose(currentRequest(satisfied)).purpose_assessment;
  ok(r.conditions_known && r.conditions_satisfied && r.admissible);
});

t('SATISFIED without structured evidence is rejected', () => {
  throws(
    () => validateApplicabilityConditions({
      status: APPLICABILITY_CONDITION_STATUS.SATISFIED,
      evidence: [],
    }),
    'APPLICABILITY_CONDITIONS_EVIDENCE_REQUIRED'
  );
});

t('derived false, unconfirmed, and absent conditions fail current operational', () => {
  const falseEntry = temporalBase();
  falseEntry.applicability_conditions.conditions = [{
    id: 'false', evaluation_mode: 'ENGINE_EVALUATED',
    predicate: { operator: 'BOOLEAN_IS', left_fact: 'applies', right_value: true },
    facts: { applies: false }, evidence: [],
  }];
  eq(assessRelianceForPurpose(currentRequest(falseEntry)).purpose_assessment.authorizes_current_operational, false);
  const unknownEntry = temporalBase();
  unknownEntry.applicability_conditions.completeness = 'UNKNOWN';
  eq(assessRelianceForPurpose(currentRequest(unknownEntry)).purpose_assessment.authorizes_current_operational, false);
  const absent = temporalBase(); delete absent.applicability_conditions;
  const r = assessRelianceForPurpose(currentRequest(absent)).purpose_assessment;
  eq(r.conditions_known, false);
  eq(r.admissible, false);
});

t('applicability interval is start-inclusive and end-exclusive', () => {
  const interval = { from: '2025-02-02', until_exclusive: '2026-08-03' };
  const atStart = assessRelianceForPurpose(currentRequest(
    temporalBase({ applicability: interval }), { as_of: '2025-02-02' }
  )).purpose_assessment;
  const atEnd = assessRelianceForPurpose(currentRequest(
    temporalBase({ applicability: interval }), { as_of: '2026-08-03' }
  )).purpose_assessment;
  ok(atStart.applicability_matches && atStart.admissible);
  eq(atEnd.applicability_matches, false);
  eq(atEnd.admissible, false);
});

t('comparative tolerates stale and missing effective interval with known authority and scope', () => {
  const entry = temporalBase({ currency: CURRENCY.STALE, expiry_status: EXPIRY.EXPIRED });
  delete entry.effective_interval;
  const r = assessRelianceForPurpose({
    entry,
    context: currentRequest(entry).context,
    reliance_purpose: RELIANCE_PURPOSE.COMPARATIVE_ANALYSIS,
  }).purpose_assessment;
  ok(r.admissible);
  eq(r.temporal_known, false);
  eq(r.authorizes_current_operational, false);
  eq(r.authorizes_historical_as_of, false);
});

t('comparative fails for unknown authority, missing scope, or unconfirmed verification', () => {
  const variants = [
    temporalBase({ authority_status: AUTHORITY.UNKNOWN }),
    (() => { const e = temporalBase(); delete e.scope; return e; })(),
    (() => {
      const e = temporalBase({ verification_state: VERIFICATION.UNCONFIRMED });
      delete e.ratification;
      return e;
    })(),
  ];
  for (const entry of variants) {
    const r = assessRelianceForPurpose({
      entry,
      context: currentRequest(entry).context,
      reliance_purpose: RELIANCE_PURPOSE.COMPARATIVE_ANALYSIS,
    }).purpose_assessment;
    eq(r.admissible, false);
  }
});

t('purpose-aware scope is unknown when declared context dimensions are unanswered', () => {
  const entry = temporalBase();
  const r = assessRelianceForPurpose(currentRequest(entry, {
    context: { subject: ['HIGH_RISK_AI_SYSTEM'] },
  })).purpose_assessment;
  eq(r.scope_known, false);
  eq(r.scope_matches, null);
  eq(r.admissible, false);
  eq(r.authorizes_current_operational, false);
});

t('historical artifact inside its effective interval passes but never authorizes current use', () => {
  const entry = temporalBase({ currency: CURRENCY.STALE, expiry_status: EXPIRY.EXPIRED });
  const r = assessRelianceForPurpose({
    entry,
    context: currentRequest(entry).context,
    reliance_purpose: RELIANCE_PURPOSE.HISTORICAL_AS_OF,
    as_of: '2025-01-01',
  }).purpose_assessment;
  ok(r.admissible);
  eq(r.temporal_matches, true);
  eq(r.authorizes_current_operational, false);
  eq(r.authorizes_historical_as_of, true);
});

t('historical fails outside or without the effective interval', () => {
  const outside = assessRelianceForPurpose({
    entry: temporalBase({ effective_interval: { from: '2025-01-01' } }),
    context: currentRequest(temporalBase()).context,
    reliance_purpose: RELIANCE_PURPOSE.HISTORICAL_AS_OF,
    as_of: '2024-12-31',
  }).purpose_assessment;
  eq(outside.admissible, false);
  eq(outside.temporal_matches, false);
  const entry = temporalBase(); delete entry.effective_interval;
  const missing = assessRelianceForPurpose({
    entry,
    context: currentRequest(entry).context,
    reliance_purpose: RELIANCE_PURPOSE.HISTORICAL_AS_OF,
    as_of: '2025-01-01',
  }).purpose_assessment;
  eq(missing.admissible, false);
  eq(missing.temporal_known, false);
});

t('historical output keeps artifact time and provision applicability separate', () => {
  const r = assessRelianceForPurpose({
    entry: temporalBase({
      effective_interval: { from: '2024-08-01' },
      applicability: { from: '2025-02-02' },
    }),
    context: currentRequest(temporalBase()).context,
    reliance_purpose: RELIANCE_PURPOSE.HISTORICAL_AS_OF,
    as_of: '2024-12-01',
  }).purpose_assessment;
  eq(r.temporal_matches, true);
  eq(r.applicability_matches, false);
});

t('current authorization conjunct mutation property holds for every required gate', () => {
  const mutations = [
    (e) => { delete e.effective_interval; },
    (e) => { delete e.applicability; },
    (e) => { delete e.scope; },
    (e) => { e.authority_status = AUTHORITY.UNKNOWN; },
    (e) => { delete e.normative_unit; },
    (e) => { e.normative_unit = { instrument: 'Synthetic Regulation 2024/0001' }; },
    (e) => { delete e.provision_segmentation; },
    (e) => { e.provision_segmentation = { status: PROVISION_SEGMENTATION_STATUS.UNKNOWN }; },
    (e) => { delete e.applicability_conditions; },
    (e) => { e.applicability_conditions.completeness = 'UNKNOWN'; },
  ];
  for (const mutate of mutations) {
    const entry = temporalBase(); mutate(entry);
    const r = assessRelianceForPurpose(currentRequest(entry)).purpose_assessment;
    eq(r.authorizes_current_operational, false);
    ok(!(r.authorizes_current_operational && (
      !r.temporal_known || !r.applicability_known || !r.scope_known
    )));
  }
});

t('purpose assessment is deterministic and does not read the system clock', () => {
  const request = currentRequest(temporalBase());
  eq(assessRelianceForPurpose(request), assessRelianceForPurpose(request));
});

t('provision segmentation validator rejects unknown enum values', () => {
  throws(() => validateProvisionSegmentation({ status: 'BOGUS' }), 'INVALID_ENUM');
});

console.log('\nnorms-mcp — revalidation\n');

t('matching fingerprint yields CURRENT', () => {
  const idx = { 'POLICY.md': { sha256: RATIFIED_PROOF.sha256 } };
  eq(revalidate(base(), idx).currency, CURRENCY.CURRENT);
});

t('diverged fingerprint yields STALE, not INVALID', () => {
  const idx = { 'POLICY.md': { sha256: 'f'.repeat(64) } };
  const r = revalidate(base(), idx);
  eq(r.currency, CURRENCY.STALE);
  ok(r.reason.includes('revalidation'), 'must be framed as revalidation, not falsification');
});

t('absent source document yields UNKNOWN, not STALE', () => {
  eq(revalidate(base(), {}).currency, CURRENCY.UNKNOWN);
});

console.log('\nnorms-mcp — expiry policy\n');

t('PERMANENT without recorded grounds is rejected', () => {
  throws(() => evaluateExpiry(base({ expiry_policy: EXPIRY_POLICY.PERMANENT })), 'PERMANENT_WITHOUT_GROUNDS');
});

t('PERMANENT with grounds stays ACTIVE', () => {
  const e = base({ expiry_policy: EXPIRY_POLICY.PERMANENT, permanence: { authority: 'owner', reason: 'safety invariant' } });
  eq(evaluateExpiry(e).expiry_status, EXPIRY.ACTIVE);
});

t('CONDITIONAL expires when a lapse condition fires', () => {
  const e = base({ expiry_policy: EXPIRY_POLICY.CONDITIONAL, lapse_conditions: [{ text: 'APK distributed beyond perimeter', fired: true }] });
  eq(evaluateExpiry(e).expiry_status, EXPIRY.EXPIRED);
});

t('REVIEWED becomes REVIEW_DUE after its date', () => {
  const e = base({ expiry_policy: EXPIRY_POLICY.REVIEWED, review: { review_at: '2026-01-01' } });
  eq(evaluateExpiry(e, new Date('2026-07-31')).expiry_status, EXPIRY.REVIEW_DUE);
});

console.log('\nnorms-mcp — canonicalisation\n');

t('byteLength counts UTF-8 bytes, not UTF-16 code units', () => {
  const s = '𝄞';                    // U+1D11E, outside the BMP
  eq(s.length, 2, 'JS string length is UTF-16 code units:');
  eq(byteLength(s), 4, 'UTF-8 byte length:');
});

t('canonicalisation strips BOM, normalises CRLF and trailing whitespace', () => {
  eq(canonicaliseContent('\uFEFFa  \r\nb\t\r\nc'), 'a\nb\nc');
});

t('NFC normalisation makes the two encodings of é agree', () => {
  eq(documentDigest('e\u0301'), documentDigest('\u00e9'));
});

t('COLLISION: plain concatenation is ambiguous', () => {
  // Two different corpora whose naive id+content concatenation is identical.
  const A = { 'ab': 'cd', 'x': 'y' };
  const B = { 'a': 'bcd', 'x': 'y' };
  const naive = (docs) => Object.entries(docs).sort().map(([k, v]) => k + v).join('');
  eq(naive(A), naive(B), 'the two corpora must collide under naive concatenation');
  ok(corpusDigest(A) !== corpusDigest(B), 'framed digests must differ');
});

t('digest is stable across seedings and insertion order', () => {
  const A = { alpha: 'one', beta: 'two', gamma: 'three' };
  const B = { gamma: 'three', alpha: 'one', beta: 'two' };
  eq(corpusDigest(A), corpusDigest(B));
});

t('digest is insensitive to line endings and trailing whitespace', () => {
  eq(corpusDigest({ d: 'a\nb\n' }), corpusDigest({ d: 'a  \r\nb\t\r\n' }));
});

t('digest changes when content changes', () => {
  ok(corpusDigest({ d: 'a' }) !== corpusDigest({ d: 'b' }));
});

t('legacy record bytes retain their frozen document digest', () => {
  const legacy = JSON.stringify({
    key: 'LEGACY',
    origin: { type: 'SOURCE_DOCUMENT' },
    verification_state: 'UNCONFIRMED',
    currency: 'UNKNOWN',
    authority_status: 'UNKNOWN',
    expiry_status: 'UNKNOWN',
  });
  eq(documentDigest(legacy), '6166ebda2a99b99dfefb66ac7c6c399db5b0a7a96b1bd55006cc1031e0e97fdb');
});

t('duplicate document ids are rejected', () => {
  let threw = false;
  try { canonicalBytes([{ id: 'a', content: '1' }, { id: 'a', content: '2' }]); } catch { threw = true; }
  ok(threw);
});

t('drift detection reports divergence from the served digest', () => {
  const docs = { d: 'content' };
  eq(detectDrift(docs, corpusDigest(docs)).drift, false);
  eq(detectDrift(docs, 'a'.repeat(64)).drift, true);
});

t('index carries per-document digests usable for revalidation', () => {
  const idx = buildIndex({ 'POLICY.md': 'body' });
  ok(/^[0-9a-f]{64}$/.test(idx['POLICY.md'].sha256));
});

console.log('\nnorms-mcp — claim map linter\n');

const fullEvidence = {
  evidence_ref: 'evidence/x.log', repository: 'repo@abc123',
  artifact_sha256: 'a'.repeat(64), observed_at: '2026-07-31',
  observer: 'executing agent', scope: 'one run',
  evidence_class: EVIDENCE_CLASS.PUBLICLY_INSPECTABLE, revalidate_at: '2027-01-01',
};

t('O without evidence fields is rejected', () => {
  const r = lintClaimMap([{ id: 1, state: STATE.O }]);
  ok(!r.ok); ok(r.findings.every((f) => f.rule === 'R1'));
  eq(r.findings.length, 8);
});

t('O with full evidence passes', () => {
  ok(lintClaimMap([{ id: 1, state: STATE.O, ...fullEvidence }]).ok);
});

t('O backed only by a private digest is rejected', () => {
  const r = lintClaimMap([{ id: 1, state: STATE.O, ...fullEvidence, evidence_class: EVIDENCE_CLASS.PRIVATE_COMMITTED }]);
  ok(!r.ok); ok(r.findings.some((f) => f.rule === 'R2'));
});

t('D without derived_from or support_status is rejected', () => {
  const r = lintClaimMap([{ id: 1, state: STATE.D }]);
  eq(r.findings.filter((f) => f.rule === 'R3').length, 2);
});

t('SUPPORT RULE: D cannot be stronger than its weakest premise', () => {
  const r = lintClaimMap([
    { id: 1, state: STATE.O_PENDING },
    { id: 2, state: STATE.D, derived_from: [1], support_status: 'O' },
  ]);
  ok(!r.ok); ok(r.findings.some((f) => f.rule === 'R4'), 'R4 must fire');
});

t('SUPPORT RULE: D matching its weakest premise passes', () => {
  ok(lintClaimMap([
    { id: 1, state: STATE.O_PENDING },
    { id: 2, state: STATE.D, derived_from: [1], support_status: 'O-PENDING' },
  ]).ok);
});

t('SUPPORT RULE: weakest of several premises governs', () => {
  const r = lintClaimMap([
    { id: 1, state: STATE.O, ...fullEvidence },
    { id: 2, state: STATE.A, precondition: 'a trial' },
    { id: 3, state: STATE.D, derived_from: [1, 2], support_status: 'O' },
  ]);
  ok(!r.ok); ok(r.findings.some((f) => f.rule === 'R4'));
});

t('A without a precondition is rejected', () => {
  ok(lintClaimMap([{ id: 1, state: STATE.A }]).findings.some((f) => f.rule === 'R5'));
});

t('derived_from pointing at a non-existent claim is rejected', () => {
  const r = lintClaimMap([{ id: 1, state: STATE.D, derived_from: [99], support_status: 'D' }]);
  ok(r.findings.some((f) => f.rule === 'R6'));
});

t('cycles in derived_from are detected', () => {
  const r = lintClaimMap([
    { id: 1, state: STATE.D, derived_from: [2], support_status: 'D' },
    { id: 2, state: STATE.D, derived_from: [1], support_status: 'D' },
  ]);
  ok(r.findings.some((f) => f.rule === 'R7'));
});

t('withdrawn rows are exempt', () => {
  ok(lintClaimMap([{ id: 18, state: null, withdrawn: true }]).ok);
});

t('counts report the shape of the map', () => {
  const r = lintClaimMap([
    { id: 1, state: STATE.O, ...fullEvidence },
    { id: 2, state: STATE.O_PENDING },
    { id: 3, state: STATE.A, precondition: 'x' },
  ]);
  eq(r.counts.O, 1); eq(r.counts['O-PENDING'], 1); eq(r.counts.A, 1);
});


console.log('\nnorms-mcp — fail-closed (regressions from review 7)\n');

t('empty scope throws instead of matching everything', () => {
  throws(() => admissibleFor(base({ scope: {} }), { subject: 'x' }), 'SCOPE_EMPTY');
});

t('malformed scope throws instead of matching', () => {
  throws(() => admissibleFor(base({ scope: 'not-an-object' }), {}), 'SCOPE_MALFORMED');
});

t('scope dimension with an empty list throws', () => {
  throws(() => admissibleFor(base({ scope: { subject: [] } }), {}), 'SCOPE_DIMENSION_EMPTY');
});

t('scope dimension with non-string members throws', () => {
  throws(() => admissibleFor(base({ scope: { subject: [1] } }), {}), 'SCOPE_DIMENSION_MALFORMED');
});

t('non-object context throws', () => {
  throws(() => admissibleFor(base(), 'ctx'), 'CONTEXT_MALFORMED');
});

t('invalid review date throws instead of becoming ACTIVE', () => {
  throws(() => evaluateExpiry(base({ expiry_policy: EXPIRY_POLICY.REVIEWED, review: { review_at: 'not-a-date' } })), 'REVIEW_DATE_INVALID');
});

t('a bare number is not accepted as a review date', () => {
  throws(() => evaluateExpiry(base({ expiry_policy: EXPIRY_POLICY.REVIEWED, review: { review_at: '7' } })), 'REVIEW_DATE_INVALID');
});

t('CONDITIONAL without lapse_conditions yields UNKNOWN, not ACTIVE', () => {
  const r = evaluateExpiry(base({ expiry_policy: EXPIRY_POLICY.CONDITIONAL }));
  eq(r.expiry_status, EXPIRY.UNKNOWN);
});

t('CONDITIONAL with non-array lapse_conditions throws', () => {
  throws(() => evaluateExpiry(base({ expiry_policy: EXPIRY_POLICY.CONDITIONAL, lapse_conditions: 'x' })), 'LAPSE_CONDITIONS_MALFORMED');
});

t('PERMANENT without grounds cannot be laundered through eligibleAsGround', () => {
  const e = base({ expiry_policy: EXPIRY_POLICY.PERMANENT, expiry_status: EXPIRY.ACTIVE });
  throws(() => eligibleAsGround(e), 'PERMANENT_WITHOUT_GROUNDS');
});

t('unknown expiry_policy is rejected, not silently treated as REVIEWED', () => {
  throws(() => evaluateExpiry(base({ expiry_policy: 'BOGUS' })), 'INVALID_ENUM');
});

t('revalidate validates its entry rather than throwing TypeError', () => {
  const e = base(); delete e.ratification;
  throws(() => revalidate(e, {}), 'RATIFIED_WITHOUT_PROOF');
});

t('revalidate rejects a malformed index', () => {
  throws(() => revalidate(base(), 'not-an-index'), 'INDEX_MALFORMED');
});

t('revalidate accepts a Map index', () => {
  const m = new Map([['POLICY.md', { sha256: RATIFIED_PROOF.sha256 }]]);
  eq(revalidate(base(), m).currency, CURRENCY.CURRENT);
});

t('ratification with a non-ISO date is rejected', () => {
  throws(() => validateEntry(base({ ratification: { ...RATIFIED_PROOF, date: 'yesterday' } })), 'RATIFICATION_BAD_DATE');
});

t('evaluateExpiry rejects an invalid now', () => {
  throws(() => evaluateExpiry(base(), new Date('nope')), 'NOW_INVALID');
});

console.log('\nnorms-mcp — corpus admission\n');

t('buildIndex rejects duplicate ids, as canonicalBytes does', () => {
  let threw = false;
  try { buildIndex([{ id: 'a', content: '1' }, { id: 'a', content: '2' }]); } catch (e) { threw = e.code === 'DOC_ID_DUPLICATE'; }
  ok(threw, 'index and digest must apply the same admission rules');
});

t('empty document id is rejected', () => {
  let code = null;
  try { corpusDigest({ '': 'x' }); } catch (e) { code = e.code; }
  eq(code, 'DOC_ID_EMPTY');
});

t('non-string content is rejected', () => {
  let code = null;
  try { corpusDigest({ a: 42 }); } catch (e) { code = e.code; }
  eq(code, 'DOC_CONTENT_MALFORMED');
});

t('__proto__ as a document id becomes a real own property', () => {
  // NB: a { __proto__: ... } literal sets the prototype and creates no key.
  // Callers reading a corpus from disk or JSON.parse do produce a real key.
  const docs = JSON.parse('{"__proto__":"body"}');
  const idx = buildIndex(docs);
  ok(Object.hasOwn(idx, '__proto__'), 'must be an own property');
  eq(Object.keys(idx), ['__proto__']);
});

t('revalidation against a __proto__ id resolves correctly', () => {
  const idx = buildIndex(JSON.parse('{"__proto__":"body"}'));
  const e = base({ ratification: { ...RATIFIED_PROOF, document: '__proto__', sha256: idx['__proto__'].sha256 } });
  eq(revalidate(e, idx).currency, CURRENCY.CURRENT);
});

t('detectDrift rejects a malformed served digest', () => {
  let code = null;
  try { detectDrift({ a: 'b' }, 'short'); } catch (e) { code = e.code; }
  eq(code, 'DIGEST_MALFORMED');
});

console.log('\nnorms-mcp — the map lints itself\n');

t('this package claim map passes its own linter', () => {
  const r = lintClaimMap(ownClaims);
  if (!r.ok) throw new Error(r.findings.map((f) => `${f.id}[${f.rule}] ${f.message}`).join('; '));
});

t('CLAIM_MAP.md has not drifted from claims.mjs', () => {
  const committed = readFileSync(new URL('../CLAIM_MAP.md', import.meta.url), 'utf8');
  eq(committed === renderClaimMap(), true, 'run: node scripts/build-claimmap.mjs —');
});

t('parseMarkdownClaims reads the generated map, ids included', () => {
  const md = renderClaimMap();
  const rows = parseMarkdownClaims(md);
  ok(rows.length >= ownClaims.length, `parsed ${rows.length} of ${ownClaims.length}`);
  ok(rows.some((r) => r.id === 'E1'), 'must parse alphanumeric ids');
  ok(rows.some((r) => r.id === 'S1'));
  ok(rows.some((r) => r.id === 'D1'));
});

t('duplicate claim ids are rejected (R8)', () => {
  const r = lintClaimMap([{ id: 1, state: STATE.A, precondition: 'x' }, { id: 1, state: STATE.A, precondition: 'y' }]);
  ok(r.findings.some((f) => f.rule === 'R8'));
});

t('unknown support_status is rejected (R9)', () => {
  const r = lintClaimMap([{ id: 1, state: STATE.D, derived_from: [], support_status: 'BOGUS' }]);
  ok(r.findings.some((f) => f.rule === 'R9'));
});

t('D with no premises must declare SPEC or NONE (R10)', () => {
  const bad = lintClaimMap([{ id: 1, state: STATE.D, derived_from: [], support_status: 'O' }]);
  ok(bad.findings.some((f) => f.rule === 'R10'));
  ok(lintClaimMap([{ id: 1, state: STATE.D, derived_from: [], support_status: 'SPEC' }]).ok);
});

t('lintClaimMap rejects a non-array input', () => {
  let threw = false;
  try { lintClaimMap('nope'); } catch { threw = true; }
  ok(threw);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
