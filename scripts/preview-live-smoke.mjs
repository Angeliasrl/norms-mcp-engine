import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PUBLIC_CURRENT_OPERATIONAL_EXAMPLE } from '../server/public-input-contract.mjs';
import { callToolStructured, createInnocuousPdfFixture, withPdfDelete } from './preview-live-smoke-support.mjs';

const [baseUrl, outputPath] = process.argv.slice(2);
assert.ok(/^https:\/\/norms-mcp-preview-0-2-1-pipeline-0-5-1\.[a-z0-9-]+\.workers\.dev$/.test(baseUrl ?? ''), 'isolated preview workers.dev URL required');
assert.ok(outputPath, 'output path required');

const expectedTools = [
  'assess_normative_reliance',
  'audit_normative_reliance',
  'audit_uploaded_pdf',
  'create_pdf_upload_session',
  'delete_pdf_upload',
  'diagnose_native_file_envelope',
  'finalize_pdf_upload',
  'resolve_normative_evidence',
  'run_positive_current_operational_demo',
].sort();
const fixture = JSON.parse(await readFile(new URL(
  '../evidence/NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD/fixtures/direct-award-threshold-audit-01.json',
  import.meta.url,
), 'utf8'));
const normalized = baseUrl.replace(/\/$/, '');
const timed = async (operation) => {
  const started = performance.now();
  const value = await operation();
  return { value, duration_ms: Math.round((performance.now() - started) * 1000) / 1000 };
};
const projectResolution = (value) => ({
  canonical_citation: value?.canonical_citation ?? null,
  sources: value?.sources ?? null,
  matching: value?.matching ?? null,
  corroboration: value?.corroboration ?? null,
  temporal_evidence: value?.temporal_evidence ?? null,
  blocking: value?.blocking ?? [],
  unknown: value?.unknown ?? [],
  unexamined: value?.unexamined ?? true,
  audit_level: value?.audit_level ?? null,
  ready_for_norms: value?.ready_for_norms ?? false,
  evidence_package_hash: value?.evidence_package_hash ?? null,
  resolution_fingerprint: value?.resolution_fingerprint ?? null,
});
const auditArguments = (citation, requestId, asOf) => ({
  citation,
  jurisdiction: 'IT',
  ...(asOf ? { as_of: asOf } : {}),
  source_requirements: { minimum_independent_official_sources: 2, require_primary_official: true },
  request_id: requestId,
  context: structuredClone(fixture.context),
  reliance_purpose: asOf ? 'CURRENT_OPERATIONAL' : 'COMPARATIVE_ANALYSIS',
  entry_assertions: structuredClone(fixture.entry),
});

const coldHealth = await timed(() => fetch(`${normalized}/healthz`));
assert.equal(coldHealth.value.status, 200);
assert.deepEqual(await coldHealth.value.json(), { status: 'ok' });
const warmHealth = await timed(() => fetch(`${normalized}/healthz`));
assert.equal(warmHealth.value.status, 200);

const transport = new StreamableHTTPClientTransport(new URL(`${normalized}/mcp`));
const client = new Client({ name: 'norms-preview-live-smoke', version: '0.1.0' });
try {
  await client.connect(transport);
  const listed = await client.listTools();
  const toolNames = listed.tools.map(({ name }) => name).sort();
  assert.deepEqual(toolNames, expectedTools);

  const pdfBytes = createInnocuousPdfFixture();
  const session = await callToolStructured(client, { name: 'create_pdf_upload_session', arguments: { max_bytes: 1024 * 1024 } });
  const uploadTarget = new URL(session.upload_url, normalized);
  const uploadCapability = new URLSearchParams(uploadTarget.hash.slice(1)).get('upload_capability');
  assert(uploadCapability, 'upload capability must be carried in the fragment');
  assert.equal(uploadTarget.search, '');
  uploadTarget.hash = '';
  let uploaded;
  const audited = await withPdfDelete(client, session, async () => {
    const queryRejected = await fetch(`${uploadTarget}?capability=forbidden-query-value`, {
      method: 'PUT',
      headers: { authorization: `Capability ${uploadCapability}`, 'content-type': 'application/pdf', 'content-length': String(pdfBytes.byteLength) },
      body: pdfBytes,
    });
    assert.equal(queryRejected.status, 400);
    assert.equal((await queryRejected.json()).error.code, 'CAPABILITY_QUERY_REJECTED');
    const uploadResponse = await fetch(uploadTarget, {
      method: 'PUT',
      headers: { authorization: `Capability ${uploadCapability}`, 'content-type': 'application/pdf', 'content-length': String(pdfBytes.byteLength) },
      body: pdfBytes,
    });
    assert.equal(uploadResponse.status, 200);
    uploaded = await uploadResponse.json();
    assert.match(uploaded.byte_sha256, /^[0-9a-f]{64}$/);
    const finalized = await callToolStructured(client, { name: 'finalize_pdf_upload', arguments: {
      upload_id: session.upload_id,
      finalize_capability: session.finalize_capability,
      expected_sha256: uploaded.byte_sha256,
    } });
    assert.equal(finalized.state, 'FINALIZED');
    return callToolStructured(client, { name: 'audit_uploaded_pdf', arguments: {
      upload_id: session.upload_id,
      audit_capability: session.audit_capability,
      audit_request: {},
    } });
  });
  assert.equal(audited.byte_sha256, uploaded.byte_sha256);
  assert.equal(audited.pipeline_result.bundle_version, '0.2.0');
  assert.equal(audited.pipeline_result.source.byte_sha256, uploaded.byte_sha256);
  assert(audited.pipeline_result.pages.length > 0);
  assert(!JSON.stringify(audited).includes('PDF_NORMATIVE_PIPELINE_NOT_BOUND'));

  const demoTimed = await timed(() => client.callTool({ name: 'run_positive_current_operational_demo', arguments: {} }));
  const demo = demoTimed.value.structuredContent;
  assert.deepEqual(demo, { authorizes_current_operational: true, admissible: true, blocking: [], unknown: [], unexamined: false });

  const exploit = await client.callTool({ name: 'assess_normative_reliance', arguments: structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE) });
  assert.equal(exploit.structuredContent.purpose_assessment.authorizes_current_operational, false);
  assert.equal(exploit.structuredContent.purpose_assessment.admissible, false);
  assert.equal(exploit.structuredContent.trust_boundary.classification, 'CALLER_SUPPLIED_UNTRUSTED');
  assert.equal(exploit.structuredContent.trust_boundary.accepted_count, 0);

  const citation = 'Decreto legislativo 31 marzo 2023, n. 36, articolo 50';
  const liveResolve = await timed(() => client.callTool({ name: 'resolve_normative_evidence', arguments: {
    citation,
    jurisdiction: 'IT',
    source_requirements: { minimum_independent_official_sources: 2, require_primary_official: true },
    request_id: 'preview-live-dlgs36-art50',
  } }));
  const liveAudit = await timed(() => client.callTool({ name: 'audit_normative_reliance', arguments: auditArguments(citation, 'preview-audit-dlgs36-art50') }));

  const negative = await timed(() => client.callTool({ name: 'audit_normative_reliance', arguments: auditArguments(
    'Decreto legislativo 31 marzo 2023, n. 999999, articolo 50',
    'preview-negative-dlgs999999-art50',
  ) }));
  assert.equal(negative.value.structuredContent.normative_assessment, null, 'Core must not run for negative resolution');
  assert.equal(negative.value.structuredContent.unexamined, true);

  const temporal = await timed(() => client.callTool({ name: 'audit_normative_reliance', arguments: auditArguments(
    citation,
    'preview-temporal-dlgs36-art50',
    '2022-01-01',
  ) }));
  assert.equal(temporal.value.structuredContent.normative_assessment, null, 'Core must not run for temporally insufficient resolution');
  assert.equal(temporal.value.structuredContent.unexamined, true);

  const liveAssessment = liveAudit.value.structuredContent;
  const report = {
    schema_version: 'norms-preview-live-report/0.1',
    preview_url: normalized,
    server_version: client.getServerVersion(),
    tools: toolNames,
    pdf_lifecycle: {
      upload: 'PASS', finalize: 'PASS', audit: 'PASS', delete: 'PASS',
      query_capability_rejected: true, verified_absent: true,
    },
    health: { cold_ms: coldHealth.duration_ms, warm_ms: warmHealth.duration_ms },
    demo: { ...demo, duration_ms: demoTimed.duration_ms },
    caller_trust_exploit: {
      authorizes_current_operational: exploit.structuredContent.purpose_assessment.authorizes_current_operational,
      admissible: exploit.structuredContent.purpose_assessment.admissible,
      classification: exploit.structuredContent.trust_boundary.classification,
      accepted_count: exploit.structuredContent.trust_boundary.accepted_count,
    },
    live_positive: {
      resolution: projectResolution(liveResolve.value.structuredContent),
      resolution_duration_ms: liveResolve.duration_ms,
      audit_resolution: liveAssessment.evidence_resolution,
      normative_assessment: liveAssessment.normative_assessment,
      core_called: liveAssessment.normative_assessment !== null,
      audit_duration_ms: liveAudit.duration_ms,
      limitations: liveAssessment.limitations,
    },
    negative: {
      resolution: negative.value.structuredContent.evidence_resolution,
      core_called: false,
      blocking: negative.value.structuredContent.blocking,
      duration_ms: negative.duration_ms,
    },
    temporal_fail_closed: {
      resolution: temporal.value.structuredContent.evidence_resolution,
      core_called: false,
      blocking: temporal.value.structuredContent.blocking,
      duration_ms: temporal.duration_ms,
    },
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
} finally {
  await transport.close().catch(() => {});
}
