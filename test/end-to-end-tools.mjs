import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { auditNormativeReliance, resolveNormativeEvidence, resolveLocatorSchema } from '../server/end-to-end-tools.mjs';
import { PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE } from '../server/public-input-contract.mjs';
import { ResolverError } from '../server/resolver-client.mjs';

const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
const digest = (v) => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const packageValue = { evidence_package_schema: 'norms-live-resolution/0.4.3', resolution_fingerprint: 'a'.repeat(64), readiness: { ready_for_norms: true, immutable: true, norms_core_modified: false } };
const packageCanonicalJson = JSON.stringify(stable(packageValue));
const positive = { schema_version: 'norms-resolver-service/0.5.0', canonical_citation: {}, acquisition_receipts: [], evidence_sources: {}, matching: { classification: 'EXACT', resolution_status: 'FOUND_EXACT' }, temporal_evidence: [], corroboration: {}, contradiction_ledger: [], blocking: [], unknown: [], unexamined: [], audit_level: 'PUBLIC_RESOLVED', ready_for_norms: true, evidence_package: packageValue, package_canonical_json: packageCanonicalJson, package_sha256: createHash('sha256').update(packageCanonicalJson).digest('hex'), resolution_fingerprint: 'a'.repeat(64), metrics: {} };
const locator = { citation: 'synthetic citation', jurisdiction: 'IT', source_requirements: {}, request_id: 'test' };
const args = { ...locator, context: PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE.context, reliance_purpose: 'COMPARATIVE_ANALYSIS', entry_assertions: PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE.entry };

let coreCalls = 0;
const assess = () => { coreCalls += 1; return { purpose_assessment: { blocking: [], unknown: [], unexamined: false, admissible: true } }; };
const fake = (value = positive) => ({ resolve: async () => structuredClone(value) });

assert.equal((await resolveNormativeEvidence(locator, fake())).ready_for_norms, true);
let result = await auditNormativeReliance(args, fake(), assess);
assert.equal(coreCalls, 1); assert.equal(result.normative_assessment.purpose_assessment.admissible, true);

const volatilePackage = structuredClone(packageValue);
volatilePackage.observability = { acquisition_duration_ms: 42 };
volatilePackage.acquisition_receipts = [{ acquired_at_utc: '2026-08-06T12:00:00Z', duration_ms: 42, byte_sha256: 'c'.repeat(64) }];
const volatileProjection = structuredClone(volatilePackage);
delete volatileProjection.observability;
delete volatileProjection.acquisition_receipts[0].acquired_at_utc;
delete volatileProjection.acquisition_receipts[0].duration_ms;
const volatileCanonicalJson = JSON.stringify(stable(volatileProjection));
const volatileResponse = { ...positive, evidence_package: volatilePackage, package_canonical_json: volatileCanonicalJson, package_sha256: createHash('sha256').update(volatileCanonicalJson).digest('hex') };
result = await auditNormativeReliance(args, fake(volatileResponse), assess);
assert.equal(result.normative_assessment.purpose_assessment.admissible, true);

for (const [mutation, code] of [
  [(v) => { v.ready_for_norms = false; }, 'RESOLUTION_NOT_PUBLIC_RESOLVED'],
  [(v) => { v.audit_level = 'DOCUMENT_ONLY'; }, 'RESOLUTION_NOT_PUBLIC_RESOLVED'],
  [(v) => { v.package_sha256 = 'b'.repeat(64); }, 'EVIDENCE_PACKAGE_HASH_INVALID'],
  [(v) => { v.blocking = ['X']; }, 'RESOLUTION_BLOCKED'],
]) {
  const value = structuredClone(positive); mutation(value); const before = coreCalls;
  result = await auditNormativeReliance(args, fake(value), assess); assert.equal(result.blocking[0], code); assert.equal(coreCalls, before);
}

result = await auditNormativeReliance(args, { resolve: async () => { throw new ResolverError('RESOLVER_TIMEOUT', 'timeout'); } }, assess);
assert.equal(result.blocking[0], 'RESOLVER_TIMEOUT');
result = await auditNormativeReliance({ ...args, trusted_external_evaluations: [{ evidence_package_sha256: 'b'.repeat(64), rule_id: 'x', evaluator_id: 'x', authority_id: 'x', outcome: 'SATISFIED' }] }, fake(), assess);
assert.equal(result.normative_assessment !== null, true);

const pipelineContract = JSON.parse(readFileSync(new URL('../contracts/resolver-service-contract-0.5.0.json', import.meta.url)));
assert.equal(pipelineContract.contract_version, 'norms-resolver-service/0.5.0');

// --- §7 activation: reference branch reachable, new fields projected ---
const response060 = {
  ...positive,
  schema_version: 'norms-resolver-service/0.6.0',
  segnalazione: 'Riferimento risolto sulla fonte.',
  resolution_outcome: { status: 'RESOLVED_MATCH' },
  resolution_provenance: { source: 'normattiva-opendata', urn: 'urn:nir:stato:costituzione:1947-12-27~art117!vig=2026-01-01', eli: null, resolved_at: '2026-08-13T00:00:00Z', response_sha256: 'd'.repeat(64), authority_pointer: 'Gazzetta Ufficiale n. 298 del 27-12-1947' },
  temporal_selection: { selection: 'APPLIED', basis: { requested_date: '2026-01-01', applied_via: 'token-di-vigenza-urn', declared_window: { start: '2012-05-08', end: null, end_declared_open: true } } },
  completeness: { state: 'COMPLETENESS_UNATTESTED' },
  candidate_blockers: [],
  publication_variants: [{ authority_pointer: 'Gazzetta Ufficiale n. 298 del 27-12-1947', validity_window: { from: '2012-05-08', to: null, end_declared_open: true }, content_sha256: 'e'.repeat(64) }],
};
const view060 = await resolveNormativeEvidence({ reference: { scheme: 'urn:nir', value: 'urn:nir:stato:costituzione:1947-12-27', granularity: { article: '117' } }, contract_version: '0.6.0', jurisdiction: 'IT', source_requirements: {}, request_id: 'ref-1' }, fake(response060));
for (const key of ['segnalazione', 'resolution_outcome', 'resolution_provenance', 'temporal_selection', 'completeness', 'candidate_blockers', 'publication_variants']) {
  assert.ok(key in view060, `resolutionView must project ${key} for 0.6.0`);
}
assert.equal(view060.resolution_provenance.source, 'normattiva-opendata');

// Legacy response: none of the new fields appear (C1 preserved downstream).
const viewLegacy = await resolveNormativeEvidence(locator, fake());
for (const key of ['segnalazione', 'resolution_outcome', 'resolution_provenance', 'temporal_selection', 'completeness', 'candidate_blockers', 'publication_variants']) {
  assert.ok(!(key in viewLegacy), `legacy resolutionView must NOT contain ${key}`);
}

// Reference forwarded to the resolver verbatim; audit passes it through too.
let forwarded = null;
const capturing = { resolve: async (req) => { forwarded = req; return structuredClone(response060); } };
await resolveNormativeEvidence({ reference: { scheme: 'urn:nir', value: 'urn:nir:stato:decreto.legislativo:2023-03-31;36', granularity: { article: '1' } }, contract_version: '0.6.0', jurisdiction: 'IT', source_requirements: {}, request_id: 'ref-2' }, capturing);
assert.equal(forwarded.reference.value, 'urn:nir:stato:decreto.legislativo:2023-03-31;36');
assert.equal(forwarded.contract_version, '0.6.0');

// --- §7 locator schema: three-way oneOf, reference requires 0.6.0 ---
const base = { jurisdiction: 'IT', source_requirements: {}, request_id: 'x' };
const ref = { scheme: 'urn:nir', value: 'urn:nir:stato:legge:2007-12-24;244' };
assert.equal(resolveLocatorSchema.safeParse({ ...base, citation: 'L. 244/2007' }).success, true);
assert.equal(resolveLocatorSchema.safeParse({ ...base, reference: ref, contract_version: '0.6.0' }).success, true);
// reference without 0.6.0 → rejected
assert.equal(resolveLocatorSchema.safeParse({ ...base, reference: ref }).success, false);
assert.equal(resolveLocatorSchema.safeParse({ ...base, reference: ref, contract_version: '0.5.4' }).success, false);
// two members → rejected
assert.equal(resolveLocatorSchema.safeParse({ ...base, citation: 'x', reference: ref, contract_version: '0.6.0' }).success, false);
// citation still works with contract_version 0.6.0 (P6 path)
assert.equal(resolveLocatorSchema.safeParse({ ...base, citation: 'L. 244/2007', contract_version: '0.6.0' }).success, true);
// legacy citation unchanged (no contract_version)
assert.equal(resolveLocatorSchema.safeParse({ ...base, official_url: 'https://www.gazzettaufficiale.it/x' }).success, true);

console.log('end-to-end-tools: PASS');
