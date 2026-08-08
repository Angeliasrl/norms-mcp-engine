import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { POSITIVE_CURRENT_OPERATIONAL_DEMO_01 } from '../server/positive-current-operational-demo-fixture.mjs';
import { callToolStructured, verifyAttestedPdfFixture } from './preview-live-smoke-support.mjs';

const [baseUrl, outputPath, pdfFixturePath] = process.argv.slice(2);
assert.ok(/^https:\/\/norms-mcp-preview-0-2-2-pipeline-0-5-3\.[a-z0-9-]+\.workers\.dev$/.test(baseUrl ?? ''), 'isolated preview URL required');
assert.ok(outputPath && pdfFixturePath, 'output path and attested PDF fixture path required');
const normalized = baseUrl.replace(/\/$/, '');
const pdfBytes = await readFile(pdfFixturePath);
const fixtureIdentity = verifyAttestedPdfFixture(pdfBytes);
const auditRequest = {
  fixture_id: POSITIVE_CURRENT_OPERATIONAL_DEMO_01.fixture_id,
  fixture_version: POSITIVE_CURRENT_OPERATIONAL_DEMO_01.fixture_version,
  request: structuredClone(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.request),
};

const transport = new StreamableHTTPClientTransport(new URL(`${normalized}/mcp`));
const client = new Client({ name: 'norms-preview-live-core-pdf-smoke', version: '0.1.0' });
let session;
let cleanup;
let report;
try {
  await client.connect(transport);
  session = await callToolStructured(client, { name: 'create_pdf_upload_session', arguments: { max_bytes: 1024 * 1024 } });
  const uploadTarget = new URL(session.upload_url, normalized);
  const uploadCapability = new URLSearchParams(uploadTarget.hash.slice(1)).get('upload_capability');
  assert(uploadCapability); uploadTarget.hash = '';
  const uploadResponse = await fetch(uploadTarget, {
    method: 'PUT',
    headers: { authorization: `Capability ${uploadCapability}`, 'content-type': 'application/pdf', 'content-length': String(pdfBytes.byteLength) },
    body: pdfBytes,
  });
  assert.equal(uploadResponse.status, 200);
  const uploaded = await uploadResponse.json();
  assert.equal(uploaded.byte_sha256, fixtureIdentity.byte_sha256);
  const finalized = await callToolStructured(client, { name: 'finalize_pdf_upload', arguments: {
    upload_id: session.upload_id, finalize_capability: session.finalize_capability, expected_sha256: fixtureIdentity.byte_sha256,
  } });
  assert.equal(finalized.state, 'FINALIZED');
  const audited = await callToolStructured(client, { name: 'audit_uploaded_pdf', arguments: {
    upload_id: session.upload_id, audit_capability: session.audit_capability, audit_request: auditRequest,
  } });
  assert.equal(audited.pipeline_result.bundle_version, '0.2.1');
  assert.equal(audited.pipeline_result.audit_binding.pdf_sha256, fixtureIdentity.byte_sha256);
  assert.match(audited.pipeline_result.audit_binding.audit_request_sha256, /^[0-9a-f]{64}$/);
  assert.match(audited.pipeline_result.audit_binding.norms_output_sha256, /^[0-9a-f]{64}$/);
  assert.equal(audited.normative_assessment.authorizes_current_operational, true);
  assert(!audited.limitations.includes('NORMS_CORE_NOT_CALLED'));
  report = {
    schema_version: 'norms-preview-live-core-pdf-report/0.1',
    fixture: fixtureIdentity,
    bundle_version: audited.pipeline_result.bundle_version,
    audit_binding: audited.pipeline_result.audit_binding,
    normative_assessment: audited.normative_assessment,
    core_called: true,
  };
} finally {
  if (session?.upload_id && session?.delete_capability) {
    cleanup = await callToolStructured(client, { name: 'delete_pdf_upload', arguments: {
      upload_id: session.upload_id, delete_capability: session.delete_capability,
    } }).catch(() => null);
    assert.equal(cleanup?.deleted, true);
    assert.equal(cleanup?.verified_absent, true);
  }
  await transport.close().catch(() => {});
}
report.cleanup = {
  deleted: cleanup.deleted,
  verified_absent: cleanup.verified_absent,
  evidence: cleanup.cleanup_evidence,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
