export const TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_VERSION =
  'NORMS_MCP_TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_0.1.1';

export const TRUST_BOUNDARY_CLASSIFICATION = Object.freeze({
  NOT_SUPPLIED: 'NOT_SUPPLIED',
  CALLER_SUPPLIED_UNTRUSTED: 'CALLER_SUPPLIED_UNTRUSTED',
});

export const TRUST_BOUNDARY_REASON = Object.freeze({
  CALLER_SUPPLIED_UNTRUSTED:
    'trusted_external_evaluations.CALLER_SUPPLIED_UNTRUSTED',
  NO_SERVER_TRUST_POLICY:
    'trusted_external_evaluations.NO_SERVER_TRUST_POLICY_CONFIGURED',
});

/**
 * Public trusted_external_evaluations are compatibility input, not a trust
 * anchor. Version 0.1.1 has no configured external authority and therefore
 * always returns an empty registry for the deterministic Core.
 */
export function resolveServerTrustedExternalEvaluations(
  callerSuppliedTrustedExternalEvaluations,
) {
  const supplied = callerSuppliedTrustedExternalEvaluations ?? [];
  const callerSupplied = supplied.length > 0;
  return Object.freeze({
    boundary_version: TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_VERSION,
    classification: callerSupplied
      ? TRUST_BOUNDARY_CLASSIFICATION.CALLER_SUPPLIED_UNTRUSTED
      : TRUST_BOUNDARY_CLASSIFICATION.NOT_SUPPLIED,
    trusted_external_evaluations: Object.freeze([]),
    caller_supplied_count: supplied.length,
    accepted_count: 0,
    reason_codes: Object.freeze(
      callerSupplied ? [TRUST_BOUNDARY_REASON.CALLER_SUPPLIED_UNTRUSTED] : [],
    ),
  });
}

const unique = (values) => [...new Set(values)];

export function hasExternalEvaluationRequirement(entry) {
  const applicabilityConditions = entry?.applicability_conditions;
  if (applicabilityConditions === undefined || applicabilityConditions.status !== undefined) {
    return false;
  }
  const completeness = applicabilityConditions.completeness_evaluation;
  if (
    completeness?.mode === 'EXTERNAL_EVALUATION_REQUIRED' ||
    completeness?.applicability_contract !== undefined
  ) {
    return true;
  }
  return applicabilityConditions.conditions?.some(
    (condition) => condition.evaluation_mode === 'EXTERNAL_EVALUATION_REQUIRED',
  ) ?? false;
}

/** Adds stable boundary findings without mutating the Core result. */
export function applyTrustedExternalEvaluationBoundary(
  coreResult,
  resolution,
  externalEvaluationRelevant,
) {
  const result = structuredClone(coreResult);
  result.trust_boundary = {
    boundary_version: resolution.boundary_version,
    classification: resolution.classification,
    caller_supplied_count: resolution.caller_supplied_count,
    accepted_count: resolution.accepted_count,
    reason_codes: [...resolution.reason_codes],
  };
  const assessment = result.purpose_assessment;
  if (!externalEvaluationRelevant) return result;

  result.trust_boundary.reason_codes = unique([
    ...result.trust_boundary.reason_codes,
    TRUST_BOUNDARY_REASON.NO_SERVER_TRUST_POLICY,
  ]);
  assessment.unknown = unique([
    ...assessment.unknown,
    ...result.trust_boundary.reason_codes,
  ]);
  assessment.admissible = false;
  assessment.authorizes_current_operational = false;
  assessment.authorizes_historical_as_of = false;
  assessment.unexamined = assessment.blocking.length === 0 && assessment.unknown.length > 0;
  return result;
}
