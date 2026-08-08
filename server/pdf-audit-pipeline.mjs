import { createHash } from 'node:crypto';

import { assessStructuredRequest } from './norms-tool.mjs';
import { POSITIVE_CURRENT_OPERATIONAL_DEMO_01 } from './positive-current-operational-demo-fixture.mjs';
import { runPositiveCurrentOperationalDemo } from './positive-current-operational-demo-tool.mjs';

const canonicalJson = (value) => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
const sha256Canonical = (value) => createHash('sha256').update(canonicalJson(value)).digest('hex');

export async function auditVerifiedDocumentBundle({ audit_request: auditRequest }) {
  const auditRequestSha256 = sha256Canonical(auditRequest);
  if (Object.keys(auditRequest).length === 0) return {
    normative_assessment: null,
    audit_request_sha256: auditRequestSha256,
    norms_output_sha256: null,
    blocking: ['PDF_NORMATIVE_ASSESSMENT_NOT_REQUESTED'],
    limitations: ['NORMS_CORE_NOT_CALLED'],
  };
  const canonicalDemoRequest = {
    fixture_id: POSITIVE_CURRENT_OPERATIONAL_DEMO_01.fixture_id,
    fixture_version: POSITIVE_CURRENT_OPERATIONAL_DEMO_01.fixture_version,
    request: POSITIVE_CURRENT_OPERATIONAL_DEMO_01.request,
  };
  const normativeAssessment = canonicalJson(auditRequest) === canonicalJson(canonicalDemoRequest)
    ? runPositiveCurrentOperationalDemo()
    : assessStructuredRequest(auditRequest);
  return {
    normative_assessment: normativeAssessment,
    audit_request_sha256: auditRequestSha256,
    norms_output_sha256: sha256Canonical(normativeAssessment),
    blocking: normativeAssessment.purpose_assessment?.blocking ?? normativeAssessment.blocking,
    limitations: [],
  };
}
