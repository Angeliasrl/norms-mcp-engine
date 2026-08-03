/**
 * norms-mcp-engine — the admissibility model.
 *
 * Two independent axes, three-valued qualifiers, eligibility computed and never
 * asserted, applicability separated from eligibility.
 *
 * Failure discipline: every public API validates its input and throws a
 * ModelError with a stable code. A malformed record is never interpreted as a
 * negative — or positive — verdict, because "malformed" and "ineligible" are
 * different facts and conflating them is the defect this model exists to avoid.
 *
 * No I/O. Pure functions.
 */

export const ORIGIN = Object.freeze({
  SOURCE_DOCUMENT: 'SOURCE_DOCUMENT',
  OWNER_DECLARATION: 'OWNER_DECLARATION',
});

export const VERIFICATION = Object.freeze({
  RATIFIED: 'RATIFIED',
  UNCONFIRMED: 'UNCONFIRMED',
});

export const CURRENCY = Object.freeze({
  CURRENT: 'CURRENT',
  STALE: 'STALE',
  UNKNOWN: 'UNKNOWN',
});

export const AUTHORITY = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID',
  UNKNOWN: 'UNKNOWN',
});

export const EXPIRY = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVIEW_DUE: 'REVIEW_DUE',
  UNKNOWN: 'UNKNOWN',
});

export const EXPIRY_POLICY = Object.freeze({
  CONDITIONAL: 'CONDITIONAL',
  REVIEWED: 'REVIEWED',
  PERMANENT: 'PERMANENT',
});

export const RELIANCE_PURPOSE = Object.freeze({
  CURRENT_OPERATIONAL: 'CURRENT_OPERATIONAL',
  HISTORICAL_AS_OF: 'HISTORICAL_AS_OF',
  COMPARATIVE_ANALYSIS: 'COMPARATIVE_ANALYSIS',
});

export const APPLICABILITY_CONDITION_STATUS = Object.freeze({
  NONE: 'NONE',
  SATISFIED: 'SATISFIED',
  NOT_SATISFIED: 'NOT_SATISFIED',
  UNKNOWN: 'UNKNOWN',
});

export const APPLICABILITY_EVIDENCE_TYPE = Object.freeze({
  DOCUMENT_REFERENCE: 'DOCUMENT_REFERENCE',
  USER_DECLARATION: 'USER_DECLARATION',
  EXTERNAL_VERIFICATION: 'EXTERNAL_VERIFICATION',
});

export const PROVISION_SEGMENTATION_STATUS = Object.freeze({
  SEGMENTED: 'SEGMENTED',
  NOT_REQUIRED: 'NOT_REQUIRED',
  REQUIRED: 'REQUIRED',
  UNKNOWN: 'UNKNOWN',
});

export const SCOPE_DIMENSIONS = Object.freeze([
  'subject',
  'jurisdiction',
  'applicable_operations',
]);

const REQUIRED_RATIFICATION_FIELDS = ['date', 'document', 'sha256', 'section_id'];
const SHA256_HEX = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[0-9:.+-]+Z?)?$/;
const ISO_CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ModelError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const oneOf = (value, allowed, field) => {
  if (!Object.values(allowed).includes(value)) {
    throw new ModelError(
      `${field}: expected one of ${Object.values(allowed).join(', ')}, got ${JSON.stringify(value)}`,
      'INVALID_ENUM'
    );
  }
  return value;
};

/** Both checks are needed: `new Date('not-a-date')` is Invalid, but
 *  `new Date('7')` is not — a bare number parses as a year. */
const isValidDate = (s) =>
  typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(new Date(s).getTime());

/** Strict civil date used only by the temporal-purpose model. It deliberately
 * rejects timestamps, timezones and calendar-normalising inputs such as
 * 2026-02-30. Existing date fields retain their v0.1 validation semantics. */
export const isValidCivilDate = (value) => {
  if (typeof value !== 'string' || !ISO_CIVIL_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function validateEffectiveInterval(interval, key = 'entry') {
  if (!isPlainObject(interval)) {
    throw new ModelError(`${key}: effective_interval must be an object`, 'EFFECTIVE_INTERVAL_MALFORMED');
  }
  const unexpected = Object.keys(interval).filter(
    (field) => field !== 'from' && field !== 'until_exclusive'
  );
  if (unexpected.length > 0) {
    throw new ModelError(
      `${key}: effective_interval has unexpected field ${unexpected[0]}`,
      'EFFECTIVE_INTERVAL_UNEXPECTED_FIELD'
    );
  }
  if (!isValidCivilDate(interval.from)) {
    throw new ModelError(
      `${key}: effective_interval.from must be a strict YYYY-MM-DD civil date`,
      'EFFECTIVE_INTERVAL_FROM_INVALID'
    );
  }
  if (interval.until_exclusive !== undefined) {
    if (!isValidCivilDate(interval.until_exclusive)) {
      throw new ModelError(
        `${key}: effective_interval.until_exclusive must be a strict YYYY-MM-DD civil date`,
        'EFFECTIVE_INTERVAL_UNTIL_INVALID'
      );
    }
    if (interval.until_exclusive <= interval.from) {
      throw new ModelError(
        `${key}: effective_interval.until_exclusive must be later than from`,
        'EFFECTIVE_INTERVAL_ORDER_INVALID'
      );
    }
  }
  return true;
}

export function validateApplicability(interval, key = 'entry') {
  if (!isPlainObject(interval)) {
    throw new ModelError(`${key}: applicability must be an object`, 'APPLICABILITY_MALFORMED');
  }
  const unexpected = Object.keys(interval).filter(
    (field) => field !== 'from' && field !== 'until_exclusive'
  );
  if (unexpected.length > 0) {
    throw new ModelError(
      `${key}: applicability has unexpected field ${unexpected[0]}`,
      'APPLICABILITY_UNEXPECTED_FIELD'
    );
  }
  if (!isValidCivilDate(interval.from)) {
    throw new ModelError(
      `${key}: applicability.from must be a strict YYYY-MM-DD civil date`,
      'APPLICABILITY_FROM_INVALID'
    );
  }
  if (interval.until_exclusive !== undefined) {
    if (!isValidCivilDate(interval.until_exclusive)) {
      throw new ModelError(
        `${key}: applicability.until_exclusive must be a strict YYYY-MM-DD civil date`,
        'APPLICABILITY_UNTIL_INVALID'
      );
    }
    if (interval.until_exclusive <= interval.from) {
      throw new ModelError(
        `${key}: applicability.until_exclusive must be later than from`,
        'APPLICABILITY_ORDER_INVALID'
      );
    }
  }
  return true;
}

export function validateNormativeUnit(unit, key = 'entry') {
  if (!isPlainObject(unit)) {
    throw new ModelError(`${key}: normative_unit must be an object`, 'NORMATIVE_UNIT_MALFORMED');
  }
  const allowed = new Set(['instrument', 'provision', 'classification_basis']);
  const unexpected = Object.keys(unit).filter((field) => !allowed.has(field));
  if (unexpected.length > 0) {
    throw new ModelError(
      `${key}: normative_unit has unexpected field ${unexpected[0]}`,
      'NORMATIVE_UNIT_UNEXPECTED_FIELD'
    );
  }
  if (typeof unit.instrument !== 'string' || unit.instrument.length === 0) {
    throw new ModelError(
      `${key}: normative_unit.instrument must be a non-empty string`,
      'NORMATIVE_UNIT_INSTRUMENT_REQUIRED'
    );
  }
  for (const field of ['provision', 'classification_basis']) {
    if (unit[field] !== undefined && (typeof unit[field] !== 'string' || unit[field].length === 0)) {
      throw new ModelError(
        `${key}: normative_unit.${field} must be a non-empty string when present`,
        'NORMATIVE_UNIT_FIELD_MALFORMED'
      );
    }
  }
  return true;
}

export function validateApplicabilityConditions(conditions, key = 'entry') {
  if (!isPlainObject(conditions)) {
    throw new ModelError(
      `${key}: applicability_conditions must be an object`,
      'APPLICABILITY_CONDITIONS_MALFORMED'
    );
  }
  const unexpected = Object.keys(conditions).filter(
    (field) => field !== 'status' && field !== 'evidence'
  );
  if (unexpected.length > 0) {
    throw new ModelError(
      `${key}: applicability_conditions has unexpected field ${unexpected[0]}`,
      'APPLICABILITY_CONDITIONS_UNEXPECTED_FIELD'
    );
  }
  oneOf(conditions.status, APPLICABILITY_CONDITION_STATUS, `${key}: applicability_conditions.status`);
  if (!Array.isArray(conditions.evidence)) {
    throw new ModelError(
      `${key}: applicability_conditions.evidence must be an array`,
      'APPLICABILITY_CONDITIONS_EVIDENCE_MALFORMED'
    );
  }
  for (const item of conditions.evidence) {
    if (!isPlainObject(item)) {
      throw new ModelError(
        `${key}: applicability condition evidence items must be objects`,
        'APPLICABILITY_CONDITIONS_EVIDENCE_MALFORMED'
      );
    }
    const itemUnexpected = Object.keys(item).filter(
      (field) => field !== 'type' && field !== 'reference'
    );
    if (itemUnexpected.length > 0) {
      throw new ModelError(
        `${key}: applicability condition evidence has unexpected field ${itemUnexpected[0]}`,
        'APPLICABILITY_CONDITIONS_EVIDENCE_UNEXPECTED_FIELD'
      );
    }
    oneOf(item.type, APPLICABILITY_EVIDENCE_TYPE, `${key}: applicability_conditions.evidence.type`);
    if (typeof item.reference !== 'string' || item.reference.length === 0) {
      throw new ModelError(
        `${key}: applicability condition evidence reference must be a non-empty string`,
        'APPLICABILITY_CONDITIONS_EVIDENCE_MALFORMED'
      );
    }
  }
  if (
    conditions.status === APPLICABILITY_CONDITION_STATUS.SATISFIED &&
    conditions.evidence.length === 0
  ) {
    throw new ModelError(
      `${key}: SATISFIED applicability conditions require structured evidence`,
      'APPLICABILITY_CONDITIONS_EVIDENCE_REQUIRED'
    );
  }
  if (
    conditions.status === APPLICABILITY_CONDITION_STATUS.NONE &&
    conditions.evidence.length !== 0
  ) {
    throw new ModelError(
      `${key}: NONE applicability conditions cannot carry evidence`,
      'APPLICABILITY_CONDITIONS_NONE_WITH_EVIDENCE'
    );
  }
  return true;
}

export function validateProvisionSegmentation(segmentation, key = 'entry') {
  if (!isPlainObject(segmentation)) {
    throw new ModelError(
      `${key}: provision_segmentation must be an object`,
      'PROVISION_SEGMENTATION_MALFORMED'
    );
  }
  const unexpected = Object.keys(segmentation).filter((field) => field !== 'status');
  if (unexpected.length > 0) {
    throw new ModelError(
      `${key}: provision_segmentation has unexpected field ${unexpected[0]}`,
      'PROVISION_SEGMENTATION_UNEXPECTED_FIELD'
    );
  }
  oneOf(segmentation.status, PROVISION_SEGMENTATION_STATUS, `${key}: provision_segmentation.status`);
  return true;
}

/**
 * A scope must be a plain object declaring at least one known dimension with
 * non-empty string values. An empty or malformed scope is an error, never a
 * match — a fail-open here would turn "unspecified" into "applies to
 * everything".
 */
export function validateScope(scope, key = 'entry') {
  if (!isPlainObject(scope)) {
    throw new ModelError(`${key}: scope must be an object`, 'SCOPE_MALFORMED');
  }
  const declared = SCOPE_DIMENSIONS.filter((d) => scope[d] !== undefined);
  if (declared.length === 0) {
    throw new ModelError(
      `${key}: scope declares no known dimension (${SCOPE_DIMENSIONS.join(', ')})`,
      'SCOPE_EMPTY'
    );
  }
  for (const d of declared) {
    const v = scope[d];
    const list = Array.isArray(v) ? v : [v];
    if (list.length === 0) {
      throw new ModelError(`${key}: scope.${d} is an empty list`, 'SCOPE_DIMENSION_EMPTY');
    }
    for (const item of list) {
      if (typeof item !== 'string' || item.length === 0) {
        throw new ModelError(
          `${key}: scope.${d} must contain non-empty strings`,
          'SCOPE_DIMENSION_MALFORMED'
        );
      }
    }
  }
  return true;
}

/**
 * Validates an entry's shape and its policy invariants.
 * Throws rather than coercing.
 */
export function validateEntry(entry) {
  if (!isPlainObject(entry)) {
    throw new ModelError('entry must be an object', 'NOT_AN_OBJECT');
  }
  if (typeof entry.key !== 'string' || entry.key.length === 0) {
    throw new ModelError('entry.key must be a non-empty string', 'MISSING_KEY');
  }
  if (!isPlainObject(entry.origin)) {
    throw new ModelError(`${entry.key}: entry.origin is required`, 'MISSING_ORIGIN');
  }

  oneOf(entry.origin.type, ORIGIN, `${entry.key}: origin.type`);
  oneOf(entry.verification_state, VERIFICATION, `${entry.key}: verification_state`);
  oneOf(entry.currency ?? CURRENCY.UNKNOWN, CURRENCY, `${entry.key}: currency`);
  oneOf(entry.authority_status ?? AUTHORITY.UNKNOWN, AUTHORITY, `${entry.key}: authority_status`);
  oneOf(entry.expiry_status ?? EXPIRY.UNKNOWN, EXPIRY, `${entry.key}: expiry_status`);

  if (entry.effective_interval !== undefined) {
    validateEffectiveInterval(entry.effective_interval, entry.key);
  }
  if (entry.normative_unit !== undefined) validateNormativeUnit(entry.normative_unit, entry.key);
  if (entry.applicability !== undefined) validateApplicability(entry.applicability, entry.key);
  if (entry.applicability_conditions !== undefined) {
    validateApplicabilityConditions(entry.applicability_conditions, entry.key);
  }
  if (entry.provision_segmentation !== undefined) {
    validateProvisionSegmentation(entry.provision_segmentation, entry.key);
  }

  if (entry.expiry_policy !== undefined) {
    oneOf(entry.expiry_policy, EXPIRY_POLICY, `${entry.key}: expiry_policy`);

    // The permanence invariant lives here, not only in evaluateExpiry:
    // otherwise it is bypassable by never calling that function.
    if (entry.expiry_policy === EXPIRY_POLICY.PERMANENT) {
      const p = entry.permanence;
      if (!isPlainObject(p) || !p.authority || !p.reason) {
        throw new ModelError(
          `${entry.key}: PERMANENT requires permanence.authority and permanence.reason`,
          'PERMANENT_WITHOUT_GROUNDS'
        );
      }
    }

    if (entry.expiry_policy === EXPIRY_POLICY.REVIEWED) {
      const at = entry.review?.review_at;
      if (at !== undefined && !isValidDate(at)) {
        throw new ModelError(
          `${entry.key}: review.review_at must be an ISO date, got ${JSON.stringify(at)}`,
          'REVIEW_DATE_INVALID'
        );
      }
    }

    if (
      entry.expiry_policy === EXPIRY_POLICY.CONDITIONAL &&
      entry.lapse_conditions !== undefined &&
      !Array.isArray(entry.lapse_conditions)
    ) {
      throw new ModelError(
        `${entry.key}: lapse_conditions must be an array`,
        'LAPSE_CONDITIONS_MALFORMED'
      );
    }
  }

  if (entry.scope !== undefined) validateScope(entry.scope, entry.key);

  if (entry.verification_state === VERIFICATION.RATIFIED) {
    const r = entry.ratification;
    if (!isPlainObject(r)) {
      throw new ModelError(
        `${entry.key}: RATIFIED requires a ratification block`,
        'RATIFIED_WITHOUT_PROOF'
      );
    }
    for (const f of REQUIRED_RATIFICATION_FIELDS) {
      if (typeof r[f] !== 'string' || r[f].length === 0) {
        throw new ModelError(
          `${entry.key}: ratification.${f} is required and must be a non-empty string`,
          'RATIFICATION_INCOMPLETE'
        );
      }
    }
    if (!SHA256_HEX.test(r.sha256)) {
      throw new ModelError(
        `${entry.key}: ratification.sha256 must be 64 lowercase hex characters`,
        'RATIFICATION_BAD_DIGEST'
      );
    }
    if (!isValidDate(r.date)) {
      throw new ModelError(
        `${entry.key}: ratification.date must be an ISO date`,
        'RATIFICATION_BAD_DATE'
      );
    }
  }

  return true;
}

/**
 * eligible_as_ground = verification_state == RATIFIED
 *                      AND currency         == CURRENT
 *                      AND authority_status == VALID
 *                      AND expiry_status    == ACTIVE
 *
 * `blocking` — a fact was checked and found wanting.
 * `unknown`  — nobody has checked.
 * Both make an entry ineligible; only the first is a finding against it.
 */
export function eligibleAsGround(entry) {
  validateEntry(entry);

  const currency = entry.currency ?? CURRENCY.UNKNOWN;
  const authority = entry.authority_status ?? AUTHORITY.UNKNOWN;
  const expiry = entry.expiry_status ?? EXPIRY.UNKNOWN;

  const blocking = [];
  const unknown = [];

  if (entry.verification_state !== VERIFICATION.RATIFIED) {
    blocking.push('verification_state is not RATIFIED');
  }

  if (currency === CURRENCY.STALE) blocking.push('currency is STALE');
  else if (currency === CURRENCY.UNKNOWN) unknown.push('currency');

  if (authority === AUTHORITY.INVALID) blocking.push('authority_status is INVALID');
  else if (authority === AUTHORITY.UNKNOWN) unknown.push('authority_status');

  if (expiry === EXPIRY.EXPIRED) blocking.push('expiry_status is EXPIRED');
  else if (expiry === EXPIRY.REVIEW_DUE) blocking.push('expiry_status is REVIEW_DUE');
  else if (expiry === EXPIRY.UNKNOWN) unknown.push('expiry_status');

  return {
    eligible: blocking.length === 0 && unknown.length === 0,
    blocking,
    unknown,
    unexamined: blocking.length === 0 && unknown.length > 0,
  };
}

/**
 * admissible_for(entry, context)
 *
 * Eligibility asks whether an entry may be used as a ground at all.
 * Applicability asks whether it bears on the decision in front of you.
 * The engine reports the match; it never decides.
 */
export function admissibleFor(entry, context = {}) {
  if (!isPlainObject(context)) {
    throw new ModelError('context must be an object', 'CONTEXT_MALFORMED');
  }
  const elig = eligibleAsGround(entry); // validates the entry, scope included

  if (entry.scope === undefined) {
    return {
      ...elig,
      admissible: false,
      scope_known: false,
      scope_matches: null,
      note: "entry declares no scope; applicability is the caller's judgement",
    };
  }

  const matches = scopeMatches(entry.scope, context);
  return {
    ...elig,
    admissible: elig.eligible && matches,
    scope_known: true,
    scope_matches: matches,
  };
}

const currentFindingCode = (finding) => {
  const codes = {
    'verification_state is not RATIFIED': 'verification.not_ratified',
    'currency is STALE': 'current_status.currency_stale',
    'authority_status is INVALID': 'authority.invalid',
    'expiry_status is EXPIRED': 'current_status.expiry_expired',
    'expiry_status is REVIEW_DUE': 'current_status.expiry_review_due',
  };
  return codes[finding] ?? `current_status.${finding}`;
};

const currentUnknownCode = (field) => {
  const codes = {
    currency: 'current_status.currency_unknown',
    authority_status: 'authority.unknown',
    expiry_status: 'current_status.expiry_unknown',
  };
  return codes[field] ?? `current_status.${field}_unknown`;
};

const assessScope = (entry, context) => {
  if (!isPlainObject(context)) {
    throw new ModelError('context must be an object', 'CONTEXT_MALFORMED');
  }
  if (entry.scope === undefined) {
    return { known: false, matches: null };
  }
  for (const dimension of SCOPE_DIMENSIONS) {
    if (entry.scope[dimension] === undefined) continue;
    const supplied = context[dimension];
    if (supplied === undefined || (Array.isArray(supplied) && supplied.length === 0)) {
      return { known: false, matches: null };
    }
    const values = Array.isArray(supplied) ? supplied : [supplied];
    if (values.some((value) => typeof value !== 'string' || value.length === 0)) {
      throw new ModelError(
        `context.${dimension} must contain non-empty strings`,
        'CONTEXT_DIMENSION_MALFORMED'
      );
    }
  }
  return { known: true, matches: scopeMatches(entry.scope, context) };
};

const intervalContains = (interval, asOf) =>
  asOf >= interval.from &&
  (interval.until_exclusive === undefined || asOf < interval.until_exclusive);

const validatePurposeRequest = (request) => {
  if (!isPlainObject(request)) {
    throw new ModelError('request must be an object', 'PURPOSE_REQUEST_MALFORMED');
  }
  const allowed = new Set(['entry', 'context', 'reliance_purpose', 'as_of']);
  const unexpected = Object.keys(request).filter((field) => !allowed.has(field));
  if (unexpected.length > 0) {
    throw new ModelError(
      `request has unexpected field ${unexpected[0]}`,
      'PURPOSE_REQUEST_UNEXPECTED_FIELD'
    );
  }
  oneOf(request.reliance_purpose, RELIANCE_PURPOSE, 'reliance_purpose');
  const requiresAsOf =
    request.reliance_purpose === RELIANCE_PURPOSE.CURRENT_OPERATIONAL ||
    request.reliance_purpose === RELIANCE_PURPOSE.HISTORICAL_AS_OF;
  if (requiresAsOf && !isValidCivilDate(request.as_of)) {
    throw new ModelError(
      'as_of must be an explicit strict YYYY-MM-DD civil date for this purpose',
      'AS_OF_REQUIRED_OR_INVALID'
    );
  }
  if (
    request.reliance_purpose === RELIANCE_PURPOSE.COMPARATIVE_ANALYSIS &&
    request.as_of !== undefined
  ) {
    throw new ModelError(
      'as_of must be absent for COMPARATIVE_ANALYSIS',
      'AS_OF_NOT_ALLOWED'
    );
  }
};

/**
 * Purpose-aware reliance assessment. This is additive: it always returns the
 * unmodified current operational ground result and never changes
 * eligibleAsGround or admissibleFor.
 */
export function assessRelianceForPurpose(request) {
  validatePurposeRequest(request);
  const { entry, context = {}, reliance_purpose: purpose, as_of: asOf } = request;
  validateEntry(entry);
  const currentGround = eligibleAsGround(entry);
  const scope = assessScope(entry, context);
  const interval = entry.effective_interval;
  const applicability = entry.applicability;
  const reportedCurrentStatus = {
    currency: entry.currency ?? CURRENCY.UNKNOWN,
    authority_status: entry.authority_status ?? AUTHORITY.UNKNOWN,
    expiry_status: entry.expiry_status ?? EXPIRY.UNKNOWN,
  };

  const blocking = [];
  const unknown = [];
  let temporalKnown = interval !== undefined;
  let temporalMatches = null;
  const applicabilityKnown = applicability !== undefined;
  const applicabilityMatches = applicability === undefined || asOf === undefined
    ? null
    : intervalContains(applicability, asOf);
  const conditionsStatus = entry.applicability_conditions?.status ?? null;
  const conditionsKnown =
    conditionsStatus === APPLICABILITY_CONDITION_STATUS.NONE ||
    conditionsStatus === APPLICABILITY_CONDITION_STATUS.SATISFIED ||
    conditionsStatus === APPLICABILITY_CONDITION_STATUS.NOT_SATISFIED;
  const conditionsSatisfied =
    conditionsStatus === APPLICABILITY_CONDITION_STATUS.NONE ||
    conditionsStatus === APPLICABILITY_CONDITION_STATUS.SATISFIED;
  const normativeUnitKnown = entry.normative_unit !== undefined;
  const provisionIdentified =
    normativeUnitKnown && typeof entry.normative_unit.provision === 'string';
  const segmentationStatus = entry.provision_segmentation?.status ?? null;
  const segmentationKnown =
    segmentationStatus !== null &&
    segmentationStatus !== PROVISION_SEGMENTATION_STATUS.UNKNOWN;
  const requiresProvisionSegmentation =
    segmentationStatus === PROVISION_SEGMENTATION_STATUS.REQUIRED;
  const segmentationAcceptable =
    segmentationStatus === PROVISION_SEGMENTATION_STATUS.SEGMENTED ||
    segmentationStatus === PROVISION_SEGMENTATION_STATUS.NOT_REQUIRED;

  if (!scope.known) unknown.push('scope.missing');
  else if (!scope.matches) blocking.push('scope.mismatch');

  if (purpose === RELIANCE_PURPOSE.CURRENT_OPERATIONAL) {
    blocking.push(...currentGround.blocking.map(currentFindingCode));
    unknown.push(...currentGround.unknown.map(currentUnknownCode));
    if (interval === undefined) {
      unknown.push('temporal_interval.missing');
    } else {
      temporalMatches = intervalContains(interval, asOf);
      if (!temporalMatches) blocking.push('temporal_interval.mismatch');
    }
    if (!normativeUnitKnown) unknown.push('normative_unit.missing');
    else if (!provisionIdentified) unknown.push('normative_unit.provision_missing');
    if (!segmentationKnown) unknown.push('provision_segmentation.unknown');
    else if (requiresProvisionSegmentation) blocking.push('provision_segmentation.required');
    if (!applicabilityKnown) unknown.push('applicability.missing');
    else if (!applicabilityMatches) blocking.push('applicability.mismatch');
    if (!conditionsKnown) unknown.push('applicability_conditions.unknown');
    else if (!conditionsSatisfied) blocking.push('applicability_conditions.not_satisfied');
  } else {
    if (entry.verification_state !== VERIFICATION.RATIFIED) {
      blocking.push('verification.not_ratified');
    }

    // authority_status describes the competence/validity of the approving
    // authority in the v0.1 contract, not freshness. It remains a gate for all
    // purposes; no historical authority is inferred from dates.
    const authority = entry.authority_status ?? AUTHORITY.UNKNOWN;
    if (authority === AUTHORITY.INVALID) blocking.push('authority.invalid');
    else if (authority === AUTHORITY.UNKNOWN) unknown.push('authority.unknown');

    if (purpose === RELIANCE_PURPOSE.HISTORICAL_AS_OF) {
      if (interval === undefined) {
        temporalKnown = false;
        unknown.push('temporal_interval.missing');
      } else {
        temporalMatches = intervalContains(interval, asOf);
        if (!temporalMatches) blocking.push('temporal_interval.mismatch');
      }
    } else if (interval === undefined) {
      temporalKnown = false;
      unknown.push('temporal_interval.missing');
    }
    if (purpose === RELIANCE_PURPOSE.COMPARATIVE_ANALYSIS) {
      if (!normativeUnitKnown) unknown.push('normative_unit.missing');
      else if (!provisionIdentified) unknown.push('normative_unit.provision_missing');
    }
  }

  const toleratedUnknown = new Set(
    purpose === RELIANCE_PURPOSE.COMPARATIVE_ANALYSIS ? ['temporal_interval.missing'] : []
  );
  const hasGatingUnknown = unknown.some((code) => !toleratedUnknown.has(code));
  const generalPurposeGatesPass = blocking.length === 0 && !hasGatingUnknown;

  // This conjunction is intentionally explicit. A new output field cannot
  // silently become irrelevant to current operational authorization.
  const authorizesCurrentOperational =
    purpose === RELIANCE_PURPOSE.CURRENT_OPERATIONAL &&
    currentGround.eligible === true &&
    scope.known === true &&
    scope.matches === true &&
    temporalKnown === true &&
    temporalMatches === true &&
    applicabilityKnown === true &&
    applicabilityMatches === true &&
    conditionsKnown === true &&
    conditionsSatisfied === true &&
    normativeUnitKnown === true &&
    provisionIdentified === true &&
    segmentationKnown === true &&
    segmentationAcceptable === true &&
    requiresProvisionSegmentation === false &&
    blocking.length === 0 &&
    hasGatingUnknown === false;
  const purposeAdmissible = purpose === RELIANCE_PURPOSE.CURRENT_OPERATIONAL
    ? authorizesCurrentOperational
    : generalPurposeGatesPass;
  const purposeAssessment = {
    purpose,
    ...(asOf === undefined ? {} : { as_of: asOf }),
    eligible: currentGround.eligible,
    admissible: purposeAdmissible,
    blocking,
    unknown,
    unexamined: blocking.length === 0 && unknown.length > 0,
    temporal_known: temporalKnown,
    temporal_matches: temporalMatches,
    scope_known: scope.known,
    scope_matches: scope.matches,
    effective_interval: interval ?? null,
    applicability: applicability ?? null,
    applicability_known: applicabilityKnown,
    applicability_matches: applicabilityMatches,
    conditions_status: conditionsStatus,
    conditions_known: conditionsKnown,
    conditions_satisfied: conditionsSatisfied,
    normative_unit_known: normativeUnitKnown,
    provision_identified: provisionIdentified,
    segmentation_status: segmentationStatus,
    segmentation_known: segmentationKnown,
    requires_provision_segmentation: requiresProvisionSegmentation,
    instrument_status: reportedCurrentStatus,
    reported_current_status: reportedCurrentStatus,
    authorizes_current_operational: authorizesCurrentOperational,
    authorizes_historical_as_of:
      purpose === RELIANCE_PURPOSE.HISTORICAL_AS_OF && purposeAdmissible,
  };

  return {
    current_operational_ground: currentGround,
    purpose_assessment: purposeAssessment,
  };
}

/** Exact-value matching across declared dimensions. A dimension the entry does
 *  not declare does not restrict; a dimension it declares and the context
 *  cannot answer does not match. */
export function scopeMatches(scope, context) {
  validateScope(scope);
  if (!isPlainObject(context)) {
    throw new ModelError('context must be an object', 'CONTEXT_MALFORMED');
  }
  for (const d of SCOPE_DIMENSIONS) {
    const declared = scope[d];
    if (declared === undefined) continue;
    const given = context[d];
    if (given === undefined) return false;
    const list = Array.isArray(declared) ? declared : [declared];
    const givens = Array.isArray(given) ? given : [given];
    if (!givens.some((g) => list.includes(g))) return false;
  }
  return true;
}

/**
 * Revalidation. The stored fingerprint is the digest of the document the
 * verification ran against. Divergence means the proof is stale — not that the
 * constant is false.
 *
 * Lookup uses Object.hasOwn (or Map.get), so an id such as "__proto__" resolves
 * to a real record or to nothing, never to an inherited property.
 */
export function revalidate(entry, corpusIndex) {
  validateEntry(entry);
  if (!isPlainObject(corpusIndex) && !(corpusIndex instanceof Map)) {
    throw new ModelError('corpusIndex must be an object or a Map', 'INDEX_MALFORMED');
  }
  if (entry.verification_state !== VERIFICATION.RATIFIED) {
    return { currency: entry.currency ?? CURRENCY.UNKNOWN, reason: 'not ratified' };
  }

  const id = entry.ratification.document;
  const doc =
    corpusIndex instanceof Map
      ? corpusIndex.get(id)
      : Object.hasOwn(corpusIndex, id)
        ? corpusIndex[id]
        : undefined;

  if (!isPlainObject(doc) || typeof doc.sha256 !== 'string') {
    return { currency: CURRENCY.UNKNOWN, reason: 'source document not present in index' };
  }
  if (doc.sha256 === entry.ratification.sha256) {
    return { currency: CURRENCY.CURRENT, reason: 'fingerprint matches index' };
  }
  return {
    currency: CURRENCY.STALE,
    reason: 'fingerprint diverged from index; proof requires revalidation',
    was: entry.ratification.sha256,
    now: doc.sha256,
  };
}

/**
 * Expiry evaluation. Every branch fails closed: an absent policy, absent
 * conditions or an absent review date yield UNKNOWN, never ACTIVE.
 */
export function evaluateExpiry(entry, now = new Date()) {
  validateEntry(entry);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new ModelError('now must be a valid Date', 'NOW_INVALID');
  }

  const policy = entry.expiry_policy;
  if (policy === undefined) {
    return { expiry_status: EXPIRY.UNKNOWN, reason: 'no expiry_policy declared' };
  }

  if (policy === EXPIRY_POLICY.PERMANENT) {
    // grounds already enforced by validateEntry
    return { expiry_status: EXPIRY.ACTIVE, reason: 'permanent by declared decision' };
  }

  if (policy === EXPIRY_POLICY.CONDITIONAL) {
    if (!Array.isArray(entry.lapse_conditions)) {
      return {
        expiry_status: EXPIRY.UNKNOWN,
        reason:
          'CONDITIONAL without declared lapse_conditions: their absence is not evidence that none fired',
      };
    }
    const fired = entry.lapse_conditions.filter((c) => c?.fired === true);
    return fired.length > 0
      ? { expiry_status: EXPIRY.EXPIRED, reason: 'lapse condition fired', fired }
      : { expiry_status: EXPIRY.ACTIVE, reason: 'no lapse condition fired' };
  }

  // REVIEWED — the date's validity is enforced by validateEntry
  const at = entry.review?.review_at;
  if (at === undefined) {
    return { expiry_status: EXPIRY.UNKNOWN, reason: 'REVIEWED without review_at' };
  }
  return new Date(at) <= now
    ? { expiry_status: EXPIRY.REVIEW_DUE, reason: `review due since ${at}` }
    : { expiry_status: EXPIRY.ACTIVE, reason: `next review ${at}` };
}
