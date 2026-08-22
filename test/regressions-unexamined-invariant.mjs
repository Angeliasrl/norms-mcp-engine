import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { auditNormativeReliance, resolveNormativeEvidence } from '../server/end-to-end-tools.mjs';
import { PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE } from '../server/public-input-contract.mjs';
import { ResolverError } from '../server/resolver-client.mjs';

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;

const evidencePackage = {
  evidence_package_schema: 'norms-live-resolution/0.4.3',
  resolution_fingerprint: 'a'.repeat(64),
  readiness: { ready_for_norms: true, immutable: true, norms_core_modified: false },
};
const packageCanonicalJson = JSON.stringify(stable(evidencePackage));
const packageSha256 = createHash('sha256').update(packageCanonicalJson).digest('hex');
const baseResolution = {
  schema_version: 'norms-resolver-service/0.5.0',
  canonical_citation: {},
  acquisition_receipts: [],
  evidence_sources: {},
  matching: { classification: 'EXACT', resolution_status: 'FOUND_EXACT' },
  temporal_evidence: [],
  corroboration: {},
  contradiction_ledger: [],
  blocking: [],
  unknown: [],
  unexamined: [],
  audit_level: 'PUBLIC_RESOLVED',
  ready_for_norms: true,
  evidence_package: evidencePackage,
  package_canonical_json: packageCanonicalJson,
  package_sha256: packageSha256,
  resolution_fingerprint: 'a'.repeat(64),
  metrics: {},
};
const locator = {
  citation: 'synthetic citation',
  jurisdiction: 'IT',
  source_requirements: {},
  request_id: 'unexamined-invariant',
};
const args = {
  ...locator,
  context: PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE.context,
  reliance_purpose: 'COMPARATIVE_ANALYSIS',
  entry_assertions: PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE.entry,
};
const resolver = (value = baseResolution) => ({ resolve: async () => structuredClone(value) });
const rejectingResolver = (error) => ({ resolve: async () => { throw error; } });
const assessment = (overrides = {}) => () => ({
  purpose_assessment: { blocking: [], unknown: [], unexamined: false, admissible: true, ...overrides },
});

function withResolution(overrides = {}) {
  return { ...structuredClone(baseResolution), ...overrides };
}

function assertFailed(result, expectedCode) {
  assert.ok(result.blocking.length > 0, `${expectedCode}: blocking must be non-empty`);
  assert.equal(result.blocking[0], expectedCode);
  assert.equal(result.unexamined, false, `${expectedCode}: blocking must force unexamined=false`);
}

assertFailed(
  await resolveNormativeEvidence(locator, rejectingResolver(new ResolverError('RESOLVER_TIMEOUT', 'timeout'))),
  'RESOLVER_TIMEOUT',
);
assertFailed(
  await resolveNormativeEvidence(locator, rejectingResolver(new Error('offline'))),
  'RESOLVER_UNAVAILABLE',
);
assertFailed(
  await auditNormativeReliance(args, rejectingResolver(new ResolverError('RESOLVER_TIMEOUT', 'timeout')), assessment()),
  'RESOLVER_TIMEOUT',
);
assertFailed(
  await auditNormativeReliance(args, resolver(withResolution({ ready_for_norms: false })), assessment()),
  'RESOLUTION_NOT_PUBLIC_RESOLVED',
);
assertFailed(
  await auditNormativeReliance(args, resolver(withResolution({ blocking: ['resolver-block'] })), assessment()),
  'RESOLUTION_BLOCKED',
);
assertFailed(
  await auditNormativeReliance(args, resolver(withResolution({ contradiction_ledger: ['contradiction'] })), assessment()),
  'RESOLUTION_BLOCKED',
);
assertFailed(
  await auditNormativeReliance(args, resolver(withResolution({ package_sha256: 'invalid' })), assessment()),
  'EVIDENCE_PACKAGE_HASH_INVALID',
);
assertFailed(
  await auditNormativeReliance(args, resolver(withResolution({ package_canonical_json: '{' })), assessment()),
  'EVIDENCE_PACKAGE_HASH_INVALID',
);
assertFailed(
  await auditNormativeReliance(args, resolver(withResolution({ evidence_package: { ...evidencePackage, extra: true } })), assessment()),
  'EVIDENCE_PACKAGE_HASH_INVALID',
);
assertFailed(
  await auditNormativeReliance({ ...args, entry_assertions: undefined }, resolver(), assessment()),
  'NORMS_PAYLOAD_INVALID',
);

for (const [resolverValue, expected] of [
  [true, true],
  [false, false],
  [['resolver-pending'], true],
  [[], false],
  [undefined, false],
]) {
  const result = await auditNormativeReliance(
    args,
    resolver(withResolution({ unexamined: resolverValue })),
    assessment(),
  );
  assert.equal(result.unexamined, expected, `resolver unexamined ${JSON.stringify(resolverValue)}`);
}

let result = await auditNormativeReliance(
  args,
  resolver(withResolution({ unknown: ['resolver-unknown'], unexamined: [] })),
  assessment(),
);
assert.equal(result.unexamined, true, 'non-empty unknown must set unexamined=true when blocking is empty');

result = await auditNormativeReliance(args, resolver(), assessment({ unexamined: true }));
assert.equal(result.unexamined, true, 'assessment unexamined must propagate when blocking is empty');

result = await auditNormativeReliance(
  args,
  resolver(withResolution({ unknown: ['resolver-unknown'], unexamined: true })),
  assessment({ blocking: ['assessment-block'], unknown: ['assessment-unknown'], unexamined: true }),
);
assert.ok(result.blocking.length > 0);
assert.equal(result.unexamined, false, 'any blocking finding must force unexamined=false');

console.log('regressions-unexamined-invariant: PASS');
