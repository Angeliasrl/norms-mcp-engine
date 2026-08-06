import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { auditNormativeReliance, resolveNormativeEvidence } from '../server/end-to-end-tools.mjs';
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
console.log('end-to-end-tools: PASS');
