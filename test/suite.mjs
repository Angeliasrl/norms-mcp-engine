import {
  ORIGIN, VERIFICATION, CURRENCY, AUTHORITY, EXPIRY, EXPIRY_POLICY,
  validateEntry, eligibleAsGround, admissibleFor, revalidate, evaluateExpiry,
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
