// PREVIEW E2E 0.6.0 (round §8.1) — smoke dal vivo: matrice di versione §6b
// (A/B/C) + tre casi terza gamba + P6. Scrive SEMPRE il report JSON con
// request/response e hash; esce non-zero se un check fallisce.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const [baseUrl, outputPath] = process.argv.slice(2);
assert.ok(/^https:\/\/norms-mcp-e2e-preview\.[a-z0-9-]+\.workers\.dev$/.test(baseUrl ?? ''), 'isolated e2e preview workers.dev URL required');
assert.ok(outputPath, 'output path required');

const normalized = baseUrl.replace(/\/$/, '');
const AS_OF = '2026-01-01';
const FIXTURE_URL = 'https://www.gazzettaufficiale.it/eli/id/2023/03/31/23G00044/sg';
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const cases = [];
let failures = 0;

async function post(label, body) {
  const started = performance.now();
  const response = await fetch(`${normalized}/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const record = {
    label,
    request: body,
    http_status: response.status,
    response_sha256: sha256(text),
    duration_ms: Math.round(performance.now() - started),
    response: json,
    checks: [],
  };
  cases.push(record);
  return record;
}

function check(record, name, condition, detail) {
  const pass = Boolean(condition);
  if (!pass) failures += 1;
  record.checks.push({ name, pass, ...(detail !== undefined ? { detail } : {}) });
  return pass;
}

// Normalizzazione degli elementi non deterministici (stessa proiezione del
// test C1: timestamp, durate, observability; il contenuto semantico resta).
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeysDeep(value[key])]));
  }
  return value;
}

function normalizeForIdentity(result) {
  if (result === null || typeof result !== 'object') return JSON.stringify(result);
  const out = structuredClone(result);
  delete out.metrics;
  for (const receipt of out.acquisition_receipts ?? []) { delete receipt.acquired_at_utc; delete receipt.duration_ms; }
  const pkg = out.evidence_package ?? {};
  delete pkg.observability;
  for (const receipt of pkg.acquisition_receipts ?? []) { delete receipt.acquired_at_utc; delete receipt.duration_ms; }
  for (const snapshot of pkg.snapshot_references ?? []) { delete snapshot.created; }
  return JSON.stringify(sortKeysDeep(out));
}

const NEW_FIELDS = ['segnalazione', 'resolution_outcome', 'resolution_provenance', 'temporal_selection', 'completeness', 'candidate_blockers'];

// --- Health ---
const health = await fetch(`${normalized}/healthz`);
assert.equal(health.status, 200);

// --- ACQUISIZIONE LIVE: con il fix egress la fetch verso la fonte ufficiale
// deve partire e completare (documento statico su gazzettaufficiale.it) ---
const acquisition = await post('acquisition-live-official-url', {
  official_url: FIXTURE_URL,
  jurisdiction: 'IT',
  source_requirements: { require_primary_official: true },
  request_id: 'acquisition-live-1',
});
check(acquisition, 'http-200', acquisition.http_status === 200);
check(acquisition, 'egress-traversed-source-responded',
  (acquisition.response?.acquisition_receipts ?? []).some((r) => Number.isInteger(r.http_status) && r.bytes_received > 0),
  (acquisition.response?.acquisition_receipts ?? []).map((r) => ({ status: r.status, bytes: r.bytes_received, http: r.http_status })));

// --- MATRICE §6b: fixture deterministica — citazione valida che la discovery
// non risolve (zero candidati, zero byte acquisiti): A/B byte-identiche senza
// dipendere dall'umore della fonte ---
const fixtureRequest = (requestId) => ({
  citation: 'Legge 31 dicembre 2099, n. 999999',
  jurisdiction: 'IT',
  source_requirements: { require_primary_official: true },
  request_id: requestId,
});

const caseA = await post('matrix-A-version-absent', fixtureRequest('matrix-1'));
check(caseA, 'http-200', caseA.http_status === 200);
check(caseA, 'schema-legacy-0.5.0', caseA.response?.schema_version === 'norms-resolver-service/0.5.0');
check(caseA, 'no-060-fields', NEW_FIELDS.every((key) => !(key in (caseA.response ?? {}))));

const caseB = await post('matrix-B-declared-054', { ...fixtureRequest('matrix-1'), contract_version: '0.5.4' });
check(caseB, 'http-200', caseB.http_status === 200);
check(caseB, 'schema-legacy-0.5.0', caseB.response?.schema_version === 'norms-resolver-service/0.5.0');
check(caseB, 'no-060-fields', NEW_FIELDS.every((key) => !(key in (caseB.response ?? {}))));
check(caseB, 'package-sha-identical-to-A', caseA.response?.package_sha256 === caseB.response?.package_sha256,
  { a: caseA.response?.package_sha256, b: caseB.response?.package_sha256 });
check(caseB, 'bit-identical-to-A-normalized', normalizeForIdentity(caseA.response) === normalizeForIdentity(caseB.response));

const caseC = await post('matrix-C-declared-060', { ...fixtureRequest('matrix-1'), contract_version: '0.6.0' });
check(caseC, 'http-200', caseC.http_status === 200);
check(caseC, 'schema-060', caseC.response?.schema_version === 'norms-resolver-service/0.6.0');
check(caseC, 'all-060-fields-present', NEW_FIELDS.every((key) => key in (caseC.response ?? {})));
check(caseC, 'segnalazione-non-empty', typeof caseC.response?.segnalazione === 'string' && caseC.response.segnalazione.length > 0);
check(caseC, 'pinned-formula-on-empty-sources',
  (caseC.response?.evidence_sources?.sources?.length ?? 0) > 0
  || (caseC.response?.segnalazione ?? '').startsWith('Il resolver non ha individuato candidati'),
  caseC.response?.segnalazione);
check(caseC, 'typed-outcome-on-empty-sources',
  (caseC.response?.evidence_sources?.sources?.length ?? 0) > 0
  || ['SOURCE_NO_RESOLUTION', 'SOURCE_REJECTED_REFERENCE', 'SOURCE_ERROR', 'SOURCE_UNREACHABLE'].includes(
    caseC.response?.resolution_outcome?.unresolvable_reason),
  caseC.response?.resolution_outcome);

// --- SMOKE 1: Cost. art. 117 con as_of -> RESOLVED_MATCH + APPLIED ---
const cost117 = await post('smoke-1-costituzione-117', {
  contract_version: '0.6.0',
  reference: { scheme: 'urn:nir', value: 'urn:nir:stato:costituzione:1947-12-27', granularity: { article: '117' } },
  jurisdiction: 'IT',
  as_of: AS_OF,
  source_requirements: { require_primary_official: true },
  request_id: 'smoke-cost-117',
});
check(cost117, 'http-200', cost117.http_status === 200);
check(cost117, 'resolved-match', cost117.response?.resolution_outcome?.status === 'RESOLVED_MATCH',
  cost117.response?.resolution_outcome);
check(cost117, 'temporal-applied', cost117.response?.temporal_selection?.selection === 'APPLIED',
  cost117.response?.temporal_selection);
check(cost117, 'provenance-from-source', cost117.response?.resolution_provenance?.source === 'normattiva-opendata');

// --- SMOKE 2: L. 244/2007 art. 1 comma 428 -> troncamento granularita' gestito ---
const comma428 = await post('smoke-2-l244-art1-comma428', {
  contract_version: '0.6.0',
  reference: { scheme: 'urn:nir', value: 'urn:nir:stato:legge:2007-12-24;244', granularity: { article: '1', comma: '428' } },
  jurisdiction: 'IT',
  source_requirements: { require_primary_official: true },
  request_id: 'smoke-l244-c428',
});
check(comma428, 'http-200', comma428.http_status === 200);
const commaOutcome = comma428.response?.resolution_outcome ?? {};
check(comma428, 'granularity-handled',
  (commaOutcome.status === 'UNRESOLVABLE'
    && ['SOURCE_GRANULARITY_TRUNCATED', 'SOURCE_GRANULARITY_UNSUPPORTED', 'SOURCE_COMPLETENESS_UNATTESTED'].includes(commaOutcome.unresolvable_reason))
  || (commaOutcome.status === 'RESOLVED_MATCH' && commaOutcome.requested_granularity?.comma === '428'),
  commaOutcome);
check(comma428, 'never-not-exists', !/non esiste|not found/i.test(comma428.response?.segnalazione ?? ''));
check(comma428, 'fail-closed-if-unresolvable',
  commaOutcome.status !== 'UNRESOLVABLE' || comma428.response?.ready_for_norms === false);

// --- SMOKE 3: L. 244/2007 doppia pubblicazione -> DOUBLE_PUB_IDENTICAL = 1 fonte ---
const doublePub = await post('smoke-3-l244-double-publication', {
  contract_version: '0.6.0',
  reference: { scheme: 'urn:nir', value: 'urn:nir:stato:legge:2007-12-24;244', granularity: { article: '1' } },
  jurisdiction: 'IT',
  source_requirements: { require_primary_official: true },
  request_id: 'smoke-l244-double-pub',
});
check(doublePub, 'http-200', doublePub.http_status === 200);
const doubleOutcome = doublePub.response?.resolution_outcome ?? {};
check(doublePub, 'coexistence-classified', typeof doubleOutcome.status === 'string', doubleOutcome);
check(doublePub, 'double-pub-is-match-one-source',
  doubleOutcome.coexistence_kind !== 'DOUBLE_PUB_IDENTICAL'
  || (doubleOutcome.status === 'RESOLVED_MATCH'
      && doublePub.response?.evidence_sources?.independent_official_source_count === 1),
  { coexistence_kind: doubleOutcome.coexistence_kind, count: doublePub.response?.evidence_sources?.independent_official_source_count });
check(doublePub, 'never-two-sources-from-variants',
  (doublePub.response?.evidence_sources?.independent_official_source_count ?? 0) <= 1,
  doublePub.response?.evidence_sources?.independent_official_source_count);
check(doublePub, 'variants-reported', !doubleOutcome.coexistence_kind || (doublePub.response?.publication_variants?.length ?? 0) >= 2,
  doublePub.response?.publication_variants?.length);

// --- P6: citation URN-izzabile con as_of -> queryDate raggiunge il resolver ---
const p6 = await post('p6-citation-urnizable', {
  contract_version: '0.6.0',
  citation: 'Decreto legislativo 31 marzo 2023, n. 36, art. 1',
  jurisdiction: 'IT',
  as_of: AS_OF,
  source_requirements: { require_primary_official: true },
  request_id: 'smoke-p6-citation',
});
check(p6, 'http-200', p6.http_status === 200);
check(p6, 'resolver-was-reached', p6.response?.resolution_provenance?.source === 'normattiva-opendata',
  p6.response?.resolution_provenance);
check(p6, 'query-date-reached-resolver', (p6.response?.resolution_provenance?.urn ?? '').endsWith(`!vig=${AS_OF}`),
  p6.response?.resolution_provenance?.urn);
check(p6, 'citation-preserved-as-original', p6.response?.canonical_citation?.original === 'Decreto legislativo 31 marzo 2023, n. 36, art. 1');
// Esito veritiero della fonte (per art.1 oggi: RESOLVED_DIVERGENT/DOUBT è la
// classificazione onesta del resolver); il round-trip è il fatto da provare.
check(p6, 'truthful-resolved-outcome',
  ['RESOLVED_MATCH', 'RESOLVED_DIVERGENT'].includes(p6.response?.resolution_outcome?.status),
  p6.response?.resolution_outcome);
check(p6, 'fail-closed-if-divergent',
  p6.response?.resolution_outcome?.status !== 'RESOLVED_DIVERGENT' || p6.response?.ready_for_norms === false);

// --- SMOKE 4: D.Lgs. 36/2023 art. 50 (finestra di vigenza nota) ->
// RESOLVED_MATCH con 1 fonte e selezione temporale APPLIED ---
const art50 = await post('smoke-4-dlgs36-art50-match', {
  contract_version: '0.6.0',
  reference: { scheme: 'urn:nir', value: 'urn:nir:stato:decreto.legislativo:2023-03-31;36', granularity: { article: '50' } },
  jurisdiction: 'IT',
  as_of: '2024-01-27',
  source_requirements: { require_primary_official: true },
  request_id: 'smoke-dlgs36-art50',
});
check(art50, 'http-200', art50.http_status === 200);
check(art50, 'resolver-round-trip', art50.response?.resolution_provenance?.source === 'normattiva-opendata',
  art50.response?.resolution_provenance);
check(art50, 'query-date-in-urn', (art50.response?.resolution_provenance?.urn ?? '').endsWith('!vig=2024-01-27'),
  art50.response?.resolution_provenance?.urn);
check(art50, 'resolved-match', art50.response?.resolution_outcome?.status === 'RESOLVED_MATCH', art50.response?.resolution_outcome);
check(art50, 'one-source', art50.response?.evidence_sources?.independent_official_source_count === 1,
  art50.response?.evidence_sources?.independent_official_source_count);
check(art50, 'temporal-applied', art50.response?.temporal_selection?.selection === 'APPLIED', art50.response?.temporal_selection);

// --- Report ---
const report = {
  schema_version: 'norms-preview-e2e-060-smoke/0.1',
  executed_at_utc: new Date().toISOString(),
  preview_url: normalized,
  as_of_used: AS_OF,
  matrix_fixture_url: FIXTURE_URL,
  total_checks: cases.reduce((n, c) => n + c.checks.length, 0),
  failed_checks: failures,
  cases,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`checks: ${report.total_checks - failures}/${report.total_checks} pass — report: ${outputPath}`);
if (failures > 0) process.exit(1);
