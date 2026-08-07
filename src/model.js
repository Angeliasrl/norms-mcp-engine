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

export const CONDITION_COMPLETENESS = Object.freeze({
  COMPLETE: 'COMPLETE', INCOMPLETE: 'INCOMPLETE', UNKNOWN: 'UNKNOWN',
});
export const CONDITION_EVALUATION_MODE = Object.freeze({
  ENGINE_EVALUATED: 'ENGINE_EVALUATED',
  EXTERNAL_EVALUATION_REQUIRED: 'EXTERNAL_EVALUATION_REQUIRED',
});
export const CONDITION_OUTCOME = Object.freeze({
  SATISFIED: 'SATISFIED', NOT_SATISFIED: 'NOT_SATISFIED', UNKNOWN: 'UNKNOWN',
});
export const CONDITION_BASIS = Object.freeze({
  ENGINE_DERIVED: 'ENGINE_DERIVED',
  EXTERNALLY_RATIFIED: 'EXTERNALLY_RATIFIED',
  CALLER_ASSERTED_UNCONFIRMED: 'CALLER_ASSERTED_UNCONFIRMED',
  MISSING: 'MISSING',
  UNSUPPORTED: 'UNSUPPORTED',
});
export const PREDICATE_OPERATOR = Object.freeze({
  EQ: 'EQ', NEQ: 'NEQ', IN: 'IN', NOT_IN: 'NOT_IN',
  BOOLEAN_IS: 'BOOLEAN_IS',
  NUM_GT: 'NUM_GT', NUM_GTE: 'NUM_GTE', NUM_LT: 'NUM_LT', NUM_LTE: 'NUM_LTE',
  DATE_BEFORE: 'DATE_BEFORE', DATE_ON_OR_BEFORE: 'DATE_ON_OR_BEFORE',
  DATE_AFTER: 'DATE_AFTER', DATE_ON_OR_AFTER: 'DATE_ON_OR_AFTER',
  IN_INTERVAL: 'IN_INTERVAL', ALL: 'ALL', ANY: 'ANY', NOT: 'NOT',
});

const CONDITION_LIMITS = Object.freeze({
  conditions: 32, facts: 64, nodes: 128, depth: 6, operands: 16,
  evidence: 32, string: 512, identifier: 128, trustedEvaluations: 64,
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

const exactFields = (value, allowed, label, code) => {
  const unexpected = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unexpected.length) throw new ModelError(`${label} has unexpected field ${unexpected[0]}`, code);
};

const validateConditionEvidence = (items, label) => {
  if (!Array.isArray(items)) throw new ModelError(`${label} evidence must be an array`, 'CONDITION_EVIDENCE_MALFORMED');
  if (items.length > CONDITION_LIMITS.evidence) throw new ModelError(`${label} has too much evidence`, 'CONDITION_EVIDENCE_LIMIT');
  for (const item of items) {
    if (!isPlainObject(item)) throw new ModelError(`${label} evidence item must be an object`, 'CONDITION_EVIDENCE_MALFORMED');
    exactFields(item, ['type', 'reference'], label, 'CONDITION_EVIDENCE_UNEXPECTED_FIELD');
    oneOf(item.type, APPLICABILITY_EVIDENCE_TYPE, `${label}.evidence.type`);
    if (typeof item.reference !== 'string' || item.reference.length === 0 || item.reference.length > CONDITION_LIMITS.string) {
      throw new ModelError(`${label} evidence reference is invalid`, 'CONDITION_EVIDENCE_MALFORMED');
    }
  }
};

const validateExternalRatification = (r, label) => {
  if (!isPlainObject(r)) throw new ModelError(`${label} requires ratification`, 'EXTERNAL_EVALUATION_RATIFICATION_REQUIRED');
  const required = ['date', 'document', 'sha256', 'section_id', 'rule_id', 'evaluator_id', 'authority_id'];
  exactFields(r, [...required, 'section_label'], label, 'EXTERNAL_EVALUATION_RATIFICATION_UNEXPECTED_FIELD');
  for (const field of required) {
    if (typeof r[field] !== 'string' || r[field].length === 0 || r[field].length > CONDITION_LIMITS.string) {
      throw new ModelError(`${label}.ratification.${field} is required`, 'EXTERNAL_EVALUATION_RATIFICATION_INCOMPLETE');
    }
  }
  if (!isValidCivilDate(r.date)) throw new ModelError(`${label}.ratification.date is invalid`, 'EXTERNAL_EVALUATION_DATE_INVALID');
  if (!SHA256_HEX.test(r.sha256)) throw new ModelError(`${label}.ratification.sha256 is invalid`, 'EXTERNAL_EVALUATION_BAD_DIGEST');
};

const validateExternalEvaluation = (evaluation, label) => {
  if (!isPlainObject(evaluation)) throw new ModelError(`${label}.evaluation is required`, 'EXTERNAL_EVALUATION_MALFORMED');
  exactFields(evaluation, ['outcome', 'verification_state', 'evidence', 'ratification'], label, 'EXTERNAL_EVALUATION_UNEXPECTED_FIELD');
  oneOf(evaluation.outcome, CONDITION_OUTCOME, `${label}.outcome`);
  oneOf(evaluation.verification_state, VERIFICATION, `${label}.verification_state`);
  validateConditionEvidence(evaluation.evidence, label);
  if (evaluation.verification_state === VERIFICATION.RATIFIED) {
    if (evaluation.evidence.length === 0) throw new ModelError(`${label} ratified evaluation requires evidence`, 'EXTERNAL_EVALUATION_EVIDENCE_REQUIRED');
    validateExternalRatification(evaluation.ratification, label);
  } else if (evaluation.ratification !== undefined) {
    throw new ModelError(`${label} unconfirmed evaluation cannot carry ratification`, 'EXTERNAL_EVALUATION_UNCONFIRMED_WITH_RATIFICATION');
  }
};

const validateFactValue = (value, label) => {
  const valid = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  if (!valid || (typeof value === 'number' && !Number.isFinite(value)) ||
      (typeof value === 'string' && value.length > CONDITION_LIMITS.string)) {
    throw new ModelError(`${label} fact must be a bounded string, finite number, or boolean`, 'CONDITION_FACT_INVALID');
  }
};

const validatePredicate = (predicate, facts, state = { nodes: 0 }, depth = 0) => {
  if (!isPlainObject(predicate)) throw new ModelError('predicate must be an object', 'CONDITION_PREDICATE_MALFORMED');
  if (depth > CONDITION_LIMITS.depth || ++state.nodes > CONDITION_LIMITS.nodes) {
    throw new ModelError('predicate complexity limit exceeded', 'CONDITION_PREDICATE_LIMIT');
  }
  oneOf(predicate.operator, PREDICATE_OPERATOR, 'predicate.operator');
  const op = predicate.operator;
  if (op === PREDICATE_OPERATOR.ALL || op === PREDICATE_OPERATOR.ANY) {
    exactFields(predicate, ['operator', 'operands'], 'predicate', 'CONDITION_PREDICATE_UNEXPECTED_FIELD');
    if (!Array.isArray(predicate.operands) || predicate.operands.length === 0 || predicate.operands.length > CONDITION_LIMITS.operands) {
      throw new ModelError('predicate.operands is invalid', 'CONDITION_PREDICATE_LIMIT');
    }
    predicate.operands.forEach((item) => validatePredicate(item, facts, state, depth + 1));
    return;
  }
  if (op === PREDICATE_OPERATOR.NOT) {
    exactFields(predicate, ['operator', 'operand'], 'predicate', 'CONDITION_PREDICATE_UNEXPECTED_FIELD');
    validatePredicate(predicate.operand, facts, state, depth + 1); return;
  }
  if (op === PREDICATE_OPERATOR.IN_INTERVAL) {
    exactFields(predicate, ['operator', 'left_fact', 'from', 'until_exclusive'], 'predicate', 'CONDITION_PREDICATE_UNEXPECTED_FIELD');
    if (!isValidCivilDate(predicate.from) || (predicate.until_exclusive !== undefined && (!isValidCivilDate(predicate.until_exclusive) || predicate.until_exclusive <= predicate.from))) {
      throw new ModelError('predicate interval is invalid', 'CONDITION_PREDICATE_DATE_INVALID');
    }
  } else if (op === PREDICATE_OPERATOR.IN || op === PREDICATE_OPERATOR.NOT_IN) {
    exactFields(predicate, ['operator', 'left_fact', 'right_values'], 'predicate', 'CONDITION_PREDICATE_UNEXPECTED_FIELD');
    if (!Array.isArray(predicate.right_values) || predicate.right_values.length === 0 || predicate.right_values.length > CONDITION_LIMITS.operands) throw new ModelError('predicate set is invalid', 'CONDITION_PREDICATE_LIMIT');
    predicate.right_values.forEach((v) => validateFactValue(v, 'predicate'));
  } else {
    exactFields(predicate, ['operator', 'left_fact', 'right_value'], 'predicate', 'CONDITION_PREDICATE_UNEXPECTED_FIELD');
    validateFactValue(predicate.right_value, 'predicate');
  }
  if (typeof predicate.left_fact !== 'string' || !Object.hasOwn(facts, predicate.left_fact)) {
    throw new ModelError('predicate left_fact is missing', 'CONDITION_FACT_MISSING');
  }
};

export function evaluateConditionPredicate(predicate, facts) {
  if (!isPlainObject(facts)) throw new ModelError('facts must be an object', 'CONDITION_FACTS_MALFORMED');
  const keys = Object.keys(facts);
  if (keys.length > CONDITION_LIMITS.facts) throw new ModelError('too many facts', 'CONDITION_FACT_LIMIT');
  keys.forEach((key) => {
    if (key.length === 0 || key.length > CONDITION_LIMITS.identifier) throw new ModelError('fact key is invalid', 'CONDITION_FACT_KEY_INVALID');
    validateFactValue(facts[key], `facts.${key}`);
  });
  validatePredicate(predicate, facts);
  const evaluate = (node) => {
    const op = node.operator;
    if (op === 'ALL') return node.operands.every(evaluate);
    if (op === 'ANY') return node.operands.some(evaluate);
    if (op === 'NOT') return !evaluate(node.operand);
    const left = facts[node.left_fact];
    if (op === 'EQ' || op === 'NEQ') {
      if (typeof left !== typeof node.right_value) throw new ModelError('equality type mismatch', 'CONDITION_TYPE_MISMATCH');
      return op === 'EQ' ? left === node.right_value : left !== node.right_value;
    }
    if (op === 'IN' || op === 'NOT_IN') {
      if (node.right_values.some((v) => typeof v !== typeof left)) throw new ModelError('set type mismatch', 'CONDITION_TYPE_MISMATCH');
      const found = node.right_values.includes(left); return op === 'IN' ? found : !found;
    }
    if (op === 'BOOLEAN_IS') {
      if (typeof left !== 'boolean' || typeof node.right_value !== 'boolean') throw new ModelError('boolean type mismatch', 'CONDITION_TYPE_MISMATCH');
      return left === node.right_value;
    }
    if (op.startsWith('NUM_')) {
      if (typeof left !== 'number' || typeof node.right_value !== 'number') throw new ModelError('numeric type mismatch', 'CONDITION_TYPE_MISMATCH');
      return op === 'NUM_GT' ? left > node.right_value : op === 'NUM_GTE' ? left >= node.right_value : op === 'NUM_LT' ? left < node.right_value : left <= node.right_value;
    }
    if (op.startsWith('DATE_')) {
      if (!isValidCivilDate(left) || !isValidCivilDate(node.right_value)) throw new ModelError('date operand invalid', 'CONDITION_PREDICATE_DATE_INVALID');
      return op === 'DATE_BEFORE' ? left < node.right_value : op === 'DATE_ON_OR_BEFORE' ? left <= node.right_value : op === 'DATE_AFTER' ? left > node.right_value : left >= node.right_value;
    }
    if (op === 'IN_INTERVAL') {
      if (!isValidCivilDate(left)) throw new ModelError('date operand invalid', 'CONDITION_PREDICATE_DATE_INVALID');
      return left >= node.from && (node.until_exclusive === undefined || left < node.until_exclusive);
    }
    throw new ModelError('unsupported predicate', 'CONDITION_PREDICATE_UNSUPPORTED');
  };
  return { value: evaluate(predicate), basis: CONDITION_BASIS.ENGINE_DERIVED };
}

export function validatePurposeApplicabilityConditions(conditions, key = 'entry') {
  if (!isPlainObject(conditions)) throw new ModelError(`${key}: applicability_conditions must be an object`, 'PURPOSE_CONDITIONS_MALFORMED');
  if (Object.hasOwn(conditions, 'status')) throw new ModelError(`${key}: legacy status is forbidden in purpose-aware reliance`, 'PURPOSE_CONDITIONS_LEGACY_STATUS_FORBIDDEN');
  exactFields(conditions, ['completeness', 'completeness_evaluation', 'conditions'], `${key}.applicability_conditions`, 'PURPOSE_CONDITIONS_UNEXPECTED_FIELD');
  oneOf(conditions.completeness, CONDITION_COMPLETENESS, `${key}.applicability_conditions.completeness`);
  if (!Array.isArray(conditions.conditions) || conditions.conditions.length > CONDITION_LIMITS.conditions) throw new ModelError('conditions list is invalid', 'PURPOSE_CONDITIONS_LIMIT');
  if (!isPlainObject(conditions.completeness_evaluation)) throw new ModelError('completeness evaluation is required', 'CONDITION_COMPLETENESS_EVALUATION_REQUIRED');
  exactFields(conditions.completeness_evaluation, ['mode', 'evaluation', 'applicability_contract'], 'completeness_evaluation', 'CONDITION_COMPLETENESS_UNEXPECTED_FIELD');
  oneOf(conditions.completeness_evaluation.mode, CONDITION_EVALUATION_MODE, 'completeness_evaluation.mode');
  if (conditions.completeness_evaluation.mode === CONDITION_EVALUATION_MODE.EXTERNAL_EVALUATION_REQUIRED) {
    validateExternalEvaluation(conditions.completeness_evaluation.evaluation, 'completeness_evaluation');
  } else {
    validateExternalEvaluation(conditions.completeness_evaluation.applicability_contract, 'applicability_contract');
  }
  const ids = new Set();
  for (const condition of conditions.conditions) {
    if (!isPlainObject(condition)) throw new ModelError('condition must be an object', 'CONDITION_MALFORMED');
    if (typeof condition.id !== 'string' || condition.id.length === 0 || condition.id.length > CONDITION_LIMITS.identifier || ids.has(condition.id)) throw new ModelError('condition id is invalid or duplicate', 'CONDITION_ID_INVALID');
    ids.add(condition.id);
    oneOf(condition.evaluation_mode, CONDITION_EVALUATION_MODE, `${condition.id}.evaluation_mode`);
    if (condition.evaluation_mode === CONDITION_EVALUATION_MODE.ENGINE_EVALUATED) {
      exactFields(condition, ['id', 'evaluation_mode', 'predicate', 'facts', 'evidence'], condition.id, 'CONDITION_UNEXPECTED_FIELD');
      validateConditionEvidence(condition.evidence, condition.id);
      evaluateConditionPredicate(condition.predicate, condition.facts);
    } else {
      exactFields(condition, ['id', 'evaluation_mode', 'evaluation'], condition.id, 'CONDITION_UNEXPECTED_FIELD');
      validateExternalEvaluation(condition.evaluation, condition.id);
    }
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
    if (Object.hasOwn(entry.applicability_conditions, 'status')) {
      validateApplicabilityConditions(entry.applicability_conditions, entry.key);
    } else {
      validatePurposeApplicabilityConditions(entry.applicability_conditions, entry.key);
    }
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
const validateTrustRegistry = (options) => {
  if (!isPlainObject(options)) throw new ModelError('assessment options must be an object', 'TRUST_OPTIONS_MALFORMED');
  exactFields(options, ['trusted_external_evaluations'], 'assessment options', 'TRUST_OPTIONS_UNEXPECTED_FIELD');
  const registry = options.trusted_external_evaluations ?? [];
  if (!Array.isArray(registry) || registry.length > CONDITION_LIMITS.trustedEvaluations) {
    throw new ModelError('trusted evaluation registry is invalid', 'TRUST_REGISTRY_MALFORMED');
  }
  for (const item of registry) {
    if (!isPlainObject(item)) throw new ModelError('trusted registry item is invalid', 'TRUST_REGISTRY_MALFORMED');
    exactFields(item, ['evidence_package_sha256', 'rule_id', 'evaluator_id', 'authority_id', 'outcome'], 'trusted registry item', 'TRUST_REGISTRY_UNEXPECTED_FIELD');
    if (!SHA256_HEX.test(item.evidence_package_sha256)) throw new ModelError('trusted registry digest is invalid', 'TRUST_REGISTRY_BAD_DIGEST');
    for (const field of ['rule_id', 'evaluator_id', 'authority_id']) {
      if (typeof item[field] !== 'string' || item[field].length === 0 || item[field].length > CONDITION_LIMITS.string) throw new ModelError('trusted registry identity is invalid', 'TRUST_REGISTRY_MALFORMED');
    }
    oneOf(item.outcome, CONDITION_OUTCOME, 'trusted registry outcome');
  }
  return registry;
};

const assessExternalEvaluation = (evaluation, registry) => {
  if (evaluation.verification_state !== VERIFICATION.RATIFIED) {
    return { outcome: evaluation.outcome, basis: CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED };
  }
  const r = evaluation.ratification;
  const trusted = registry.some((item) =>
    item.evidence_package_sha256 === r.sha256 &&
    item.rule_id === r.rule_id &&
    item.evaluator_id === r.evaluator_id &&
    item.authority_id === r.authority_id &&
    item.outcome === evaluation.outcome
  );
  return {
    outcome: evaluation.outcome,
    basis: trusted ? CONDITION_BASIS.EXTERNALLY_RATIFIED : CONDITION_BASIS.CALLER_ASSERTED_UNCONFIRMED,
  };
};

const assessPurposeConditions = (conditions, registry) => {
  if (conditions === undefined) return {
    results: [], completenessVerified: false, known: false, satisfied: false,
    completenessResult: { outcome: CONDITION_OUTCOME.UNKNOWN, basis: CONDITION_BASIS.MISSING },
    externalRequired: true,
  };
  validatePurposeApplicabilityConditions(conditions);
  const completenessResult = conditions.completeness_evaluation.mode === CONDITION_EVALUATION_MODE.ENGINE_EVALUATED
    ? assessExternalEvaluation(conditions.completeness_evaluation.applicability_contract, registry)
    : assessExternalEvaluation(conditions.completeness_evaluation.evaluation, registry);
  const completenessVerified =
    conditions.completeness === CONDITION_COMPLETENESS.COMPLETE &&
    completenessResult.outcome === CONDITION_OUTCOME.SATISFIED &&
    (completenessResult.basis === CONDITION_BASIS.ENGINE_DERIVED ||
     completenessResult.basis === CONDITION_BASIS.EXTERNALLY_RATIFIED);
  const results = conditions.conditions.map((condition) => {
    if (condition.evaluation_mode === CONDITION_EVALUATION_MODE.ENGINE_EVALUATED) {
      const derived = evaluateConditionPredicate(condition.predicate, condition.facts);
      return {
        id: condition.id,
        outcome: derived.value ? CONDITION_OUTCOME.SATISFIED : CONDITION_OUTCOME.NOT_SATISFIED,
        basis: CONDITION_BASIS.ENGINE_DERIVED,
      };
    }
    return { id: condition.id, ...assessExternalEvaluation(condition.evaluation, registry) };
  });
  const trusted = (result) =>
    result.basis === CONDITION_BASIS.ENGINE_DERIVED ||
    result.basis === CONDITION_BASIS.EXTERNALLY_RATIFIED;
  const known = completenessVerified && results.every((r) => r.outcome !== CONDITION_OUTCOME.UNKNOWN && trusted(r));
  const satisfied = known && results.every((r) => r.outcome === CONDITION_OUTCOME.SATISFIED);
  return {
    results, completenessResult, completenessVerified, known, satisfied,
    externalRequired:
      (completenessResult.basis !== CONDITION_BASIS.ENGINE_DERIVED &&
       completenessResult.basis !== CONDITION_BASIS.EXTERNALLY_RATIFIED) ||
      results.some((r) => r.basis !== CONDITION_BASIS.ENGINE_DERIVED && r.basis !== CONDITION_BASIS.EXTERNALLY_RATIFIED),
  };
};

export function assessRelianceForPurpose(request, options = {}) {
  validatePurposeRequest(request);
  const trustRegistry = validateTrustRegistry(options);
  const { entry, context = {}, reliance_purpose: purpose, as_of: asOf } = request;
  validateEntry(entry);
  if (entry.applicability_conditions && Object.hasOwn(entry.applicability_conditions, 'status')) {
    throw new ModelError(
      'legacy applicability_conditions.status is forbidden in purpose-aware reliance',
      'PURPOSE_CONDITIONS_LEGACY_STATUS_FORBIDDEN'
    );
  }
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
  const conditionAssessment = assessPurposeConditions(entry.applicability_conditions, trustRegistry);
  const conditionsKnown = conditionAssessment.known;
  const conditionsSatisfied = conditionAssessment.satisfied;
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
    if (!conditionAssessment.completenessVerified) unknown.push('applicability_conditions.completeness_unverified');
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
    conditionAssessment.completenessVerified === true &&
    conditionAssessment.results.every((result) =>
      result.basis === CONDITION_BASIS.ENGINE_DERIVED ||
      result.basis === CONDITION_BASIS.EXTERNALLY_RATIFIED
    ) &&
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
    conditions_status: null,
    conditions_known: conditionsKnown,
    conditions_satisfied: conditionsSatisfied,
    condition_completeness: entry.applicability_conditions?.completeness ?? null,
    condition_completeness_result: conditionAssessment.completenessResult,
    condition_completeness_verified: conditionAssessment.completenessVerified,
    condition_results: conditionAssessment.results,
    external_evaluation_required: conditionAssessment.externalRequired,
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
