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

export const SCOPE_DIMENSIONS = Object.freeze([
  'subject',
  'jurisdiction',
  'applicable_operations',
]);

const REQUIRED_RATIFICATION_FIELDS = ['date', 'document', 'sha256', 'section_id'];
const SHA256_HEX = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[0-9:.+-]+Z?)?$/;

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
