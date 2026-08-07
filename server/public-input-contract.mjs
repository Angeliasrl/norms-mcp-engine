import * as z from 'zod/v4';

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a strict YYYY-MM-DD civil date');
const nonEmpty = z.string().min(1).max(512);
const identifier = z.string().min(1).max(128);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'Expected 64 lowercase hexadecimal characters');
const factValue = z.union([z.string().max(512), z.number(), z.boolean()]);
const requiredEnum = (values) => z.enum(values, {
  error: (issue) => issue.input === undefined ? 'required' : undefined,
});
const dimensionValue = z.union([nonEmpty, z.array(nonEmpty).min(1)], {
  error: (issue) => issue.input === undefined ? 'required' : undefined,
});

const evidenceSchema = z.object({
  type: requiredEnum(['DOCUMENT_REFERENCE', 'USER_DECLARATION', 'EXTERNAL_VERIFICATION'])
    .describe('The explicit source type supporting a condition or evaluation.'),
  reference: nonEmpty.describe('A bounded reference to structured supporting material.'),
}).strict().meta({ id: 'Evidence', description: 'Structured evidence; free text alone is not evidence.' });

const ratificationSchema = z.object({
  date: civilDate.describe('Date on which the normative record was ratified.'),
  document: nonEmpty.describe('Stable source-document identifier.'),
  sha256: sha256.describe('SHA-256 of the ratified source document.'),
  section_id: nonEmpty.describe('Stable identifier of the ratified section.'),
  section_label: nonEmpty.optional().describe('Optional display label; never a substitute for section_id.'),
}).strict().meta({ id: 'Ratification', description: 'Proof binding a record to a source document and section.' });

const externalRatificationSchema = ratificationSchema.extend({
  rule_id: nonEmpty.describe('Identifier of the evaluation rule.'),
  evaluator_id: nonEmpty.describe('Identifier of the evaluator.'),
  authority_id: nonEmpty.describe('Identifier of the evaluation authority.'),
}).strict().meta({ id: 'ExternalRatification' });

const externalEvaluationSchema = z.object({
  outcome: requiredEnum(['SATISFIED', 'NOT_SATISFIED', 'UNKNOWN']).describe('Reported structured outcome.'),
  verification_state: requiredEnum(['RATIFIED', 'UNCONFIRMED']).describe('Verification state of the external evaluation.'),
  evidence: z.array(evidenceSchema).max(32).describe('Structured evidence supporting the evaluation.'),
  ratification: externalRatificationSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.verification_state === 'RATIFIED' && value.ratification === undefined) {
    ctx.addIssue({ code: 'custom', path: ['ratification'], message: 'required when verification_state is RATIFIED' });
  }
  if (value.verification_state === 'UNCONFIRMED' && value.ratification !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['ratification'], message: 'must be absent when verification_state is UNCONFIRMED' });
  }
}).meta({ id: 'ExternalEvaluation' });

const predicateSchema = z.lazy(() => z.discriminatedUnion('operator', [
  z.object({
    operator: z.enum(['ALL', 'ANY']),
    operands: z.array(predicateSchema).min(1).max(16),
  }).strict(),
  z.object({ operator: z.literal('NOT'), operand: predicateSchema }).strict(),
  z.object({
    operator: z.literal('IN_INTERVAL'),
    left_fact: identifier,
    from: civilDate,
    until_exclusive: civilDate.optional(),
  }).strict(),
  z.object({
    operator: z.enum(['IN', 'NOT_IN']),
    left_fact: identifier,
    right_values: z.array(factValue).min(1).max(16),
  }).strict(),
  z.object({
    operator: z.enum([
      'EQ', 'NEQ', 'BOOLEAN_IS', 'NUM_GT', 'NUM_GTE', 'NUM_LT', 'NUM_LTE',
      'DATE_BEFORE', 'DATE_ON_OR_BEFORE', 'DATE_AFTER', 'DATE_ON_OR_AFTER',
    ]),
    left_fact: identifier,
    right_value: factValue,
  }).strict(),
])).meta({ id: 'Predicate', description: 'A bounded deterministic predicate over named atomic facts.' });

const factsSchema = z.record(identifier, factValue).meta({
  id: 'Facts',
  description: 'Extensible map of named atomic facts. Values are bounded scalars; free text is not interpreted.',
});

const engineConditionSchema = z.object({
  id: identifier.describe('Unique condition identifier within the record.'),
  evaluation_mode: z.literal('ENGINE_EVALUATED'),
  predicate: predicateSchema,
  facts: factsSchema,
  evidence: z.array(evidenceSchema).max(32),
}).strict();

const externalConditionSchema = z.object({
  id: identifier.describe('Unique condition identifier within the record.'),
  evaluation_mode: z.literal('EXTERNAL_EVALUATION_REQUIRED'),
  evaluation: externalEvaluationSchema,
}).strict();

const conditionSchema = z.discriminatedUnion('evaluation_mode', [
  engineConditionSchema,
  externalConditionSchema,
]).meta({ id: 'Condition', description: 'One explicit applicability condition.' });

const completenessEvaluationSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('EXTERNAL_EVALUATION_REQUIRED'),
    evaluation: externalEvaluationSchema,
  }).strict(),
  z.object({
    mode: z.literal('ENGINE_EVALUATED'),
    applicability_contract: externalEvaluationSchema,
  }).strict(),
]).meta({ id: 'CompletenessEvaluation' });

const applicabilityConditionsSchema = z.object({
  completeness: requiredEnum(['COMPLETE', 'INCOMPLETE', 'UNKNOWN'])
    .describe('Declared completeness of the structured condition set.'),
  completeness_evaluation: completenessEvaluationSchema,
  conditions: z.array(conditionSchema).max(32),
}).strict().meta({ id: 'ApplicabilityConditions' });

const intervalShape = {
  from: civilDate.describe('Inclusive first applicable civil date.'),
  until_exclusive: civilDate.optional().describe('Optional exclusive end civil date.'),
};
const effectiveIntervalSchema = z.object(intervalShape).strict().meta({ id: 'EffectiveInterval' });
const applicabilitySchema = z.object(intervalShape).strict().meta({ id: 'Applicability' });

const scopeShape = {
  subject: dimensionValue.describe('Structured subject identifiers.'),
  jurisdiction: dimensionValue.describe('Structured jurisdiction identifiers.'),
  applicable_operations: dimensionValue.describe('Structured operation identifiers.'),
};
const scopeSchema = z.object(scopeShape).strict().meta({ id: 'Scope' });
const contextSchema = z.object(scopeShape).strict().meta({
  id: 'Context',
  description: 'The declared evaluation context. All three dimensions are explicit and required.',
});

const normativeUnitSchema = z.object({
  instrument: nonEmpty.describe('Identifier of the normative instrument.'),
  provision: nonEmpty.optional().describe('Identifier of the selected provision; absence fails closed.'),
  classification_basis: nonEmpty.optional().describe('Structured basis for the unit classification.'),
}).strict().meta({ id: 'NormativeUnit' });

const provisionSegmentationSchema = z.object({
  status: z.enum(['SEGMENTED', 'NOT_REQUIRED', 'REQUIRED', 'UNKNOWN']),
}).strict().meta({ id: 'ProvisionSegmentation' });

const originSchema = z.object({
  type: requiredEnum(['SOURCE_DOCUMENT', 'OWNER_DECLARATION']),
  date: civilDate.describe('Date associated with the declared origin.'),
}).strict().meta({ id: 'Origin' });

const permanenceSchema = z.object({ authority: nonEmpty, reason: nonEmpty }).strict().meta({ id: 'Permanence' });
const reviewSchema = z.object({ review_at: civilDate.optional() }).strict().meta({ id: 'Review' });
const lapseConditionSchema = z.object({ text: nonEmpty.optional(), fired: z.boolean().optional() })
  .strict().meta({ id: 'LapseCondition' });

const entrySchema = z.object({
  key: nonEmpty.describe('Stable identifier of the normative record.'),
  value: z.string().max(4096).optional().describe('Optional display text; never used as normative evidence.'),
  origin: originSchema,
  verification_state: requiredEnum(['RATIFIED', 'UNCONFIRMED']).describe('Verification state of the record.'),
  currency: requiredEnum(['CURRENT', 'STALE', 'UNKNOWN']).describe('Reported record currency.'),
  authority_status: requiredEnum(['VALID', 'INVALID', 'UNKNOWN']).describe('Reported authority status.'),
  expiry_status: requiredEnum(['ACTIVE', 'EXPIRED', 'REVIEW_DUE', 'UNKNOWN']).describe('Reported expiry status.'),
  ratification: ratificationSchema.optional(),
  scope: scopeSchema,
  effective_interval: effectiveIntervalSchema.optional(),
  normative_unit: normativeUnitSchema.optional(),
  provision_segmentation: provisionSegmentationSchema.optional(),
  applicability: applicabilitySchema.optional(),
  applicability_conditions: applicabilityConditionsSchema.optional(),
  expiry_policy: z.enum(['CONDITIONAL', 'REVIEWED', 'PERMANENT']).optional(),
  permanence: permanenceSchema.optional(),
  review: reviewSchema.optional(),
  lapse_conditions: z.array(lapseConditionSchema).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.verification_state === 'RATIFIED' && value.ratification === undefined) {
    ctx.addIssue({ code: 'custom', path: ['ratification'], message: 'required when verification_state is RATIFIED' });
  }
  if (value.verification_state === 'UNCONFIRMED' && value.ratification !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['ratification'], message: 'must be absent when verification_state is UNCONFIRMED' });
  }
  if (value.expiry_policy === 'PERMANENT' && value.permanence === undefined) {
    ctx.addIssue({ code: 'custom', path: ['permanence'], message: 'required when expiry_policy is PERMANENT' });
  }
}).meta({ id: 'NormativeEntry', description: 'A structured normative record already prepared and verified outside NORMS.' });

const trustedEvaluationSchema = z.object({
  evidence_package_sha256: sha256,
  rule_id: nonEmpty,
  evaluator_id: nonEmpty,
  authority_id: nonEmpty,
  outcome: z.enum(['SATISFIED', 'NOT_SATISFIED', 'UNKNOWN']),
}).strict().meta({
  id: 'TrustedExternalEvaluation',
  description: 'Deprecated compatibility input. Caller-supplied entries are classified CALLER_SUPPLIED_UNTRUSTED and never enter the server trust registry.',
});

const purposeOneOf = [
  {
    title: 'Current operational assessment',
    properties: { reliance_purpose: { const: 'CURRENT_OPERATIONAL' } },
    required: ['as_of'],
  },
  {
    title: 'Historical assessment',
    properties: { reliance_purpose: { const: 'HISTORICAL_AS_OF' } },
    required: ['as_of'],
  },
  {
    title: 'Comparative analysis',
    properties: { reliance_purpose: { const: 'COMPARATIVE_ANALYSIS' } },
    not: { required: ['as_of'] },
  },
];

export const publicInputSchema = z.object({
  entry: entrySchema,
  context: contextSchema,
  reliance_purpose: z.enum(['CURRENT_OPERATIONAL', 'HISTORICAL_AS_OF', 'COMPARATIVE_ANALYSIS']),
  as_of: civilDate.optional(),
  trusted_external_evaluations: z.array(trustedEvaluationSchema).max(64).optional()
    .describe('Deprecated compatibility field. It is never treated as server-side trust.'),
}).strict().superRefine((value, ctx) => {
  const requiresAsOf = value.reliance_purpose === 'CURRENT_OPERATIONAL' || value.reliance_purpose === 'HISTORICAL_AS_OF';
  if (requiresAsOf && value.as_of === undefined) {
    ctx.addIssue({ code: 'custom', path: ['as_of'], message: `required for ${value.reliance_purpose}` });
  }
  if (value.reliance_purpose === 'COMPARATIVE_ANALYSIS' && value.as_of !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['as_of'], message: 'must be absent for COMPARATIVE_ANALYSIS' });
  }
}).meta({
  description: 'Canonical public input contract for assess_normative_reliance.',
  oneOf: purposeOneOf,
});

const exampleProof = {
  date: '2039-12-15',
  document: 'synthetic-public-contract.json',
  sha256: 'a'.repeat(64),
  section_id: 'synthetic-section-01',
};
const exampleScope = {
  subject: ['SYNTHETIC_SUBJECT'],
  jurisdiction: ['SYNTHETIC_JURISDICTION'],
  applicable_operations: ['SYNTHETIC_OPERATION'],
};
const exampleCompletenessProof = {
  ...exampleProof,
  sha256: 'b'.repeat(64),
  section_id: 'synthetic-condition-contract',
  rule_id: 'SYNTHETIC_COMPLETENESS_RULE',
  evaluator_id: 'SYNTHETIC_EVALUATOR',
  authority_id: 'SYNTHETIC_AUTHORITY',
};

export const PUBLIC_CURRENT_OPERATIONAL_EXAMPLE = Object.freeze({
  entry: {
    key: 'SYNTHETIC_PUBLIC_ENTRY_2040',
    origin: { type: 'SOURCE_DOCUMENT', date: '2039-12-15' },
    verification_state: 'RATIFIED',
    currency: 'CURRENT',
    authority_status: 'VALID',
    expiry_status: 'ACTIVE',
    ratification: exampleProof,
    scope: exampleScope,
    effective_interval: { from: '2040-01-01', until_exclusive: '2041-01-01' },
    normative_unit: { instrument: 'SYNTHETIC_INSTRUMENT_2040', provision: 'SYNTHETIC_PROVISION_01' },
    provision_segmentation: { status: 'SEGMENTED' },
    applicability: { from: '2040-01-01', until_exclusive: '2041-01-01' },
    applicability_conditions: {
      completeness: 'COMPLETE',
      completeness_evaluation: {
        mode: 'EXTERNAL_EVALUATION_REQUIRED',
        evaluation: {
          outcome: 'SATISFIED',
          verification_state: 'RATIFIED',
          evidence: [{ type: 'DOCUMENT_REFERENCE', reference: 'synthetic-condition-contract#complete' }],
          ratification: exampleCompletenessProof,
        },
      },
      conditions: [{
        id: 'SYNTHETIC_REQUIRED_FACT',
        evaluation_mode: 'ENGINE_EVALUATED',
        predicate: { operator: 'BOOLEAN_IS', left_fact: 'required_fact', right_value: true },
        facts: { required_fact: true },
        evidence: [{ type: 'DOCUMENT_REFERENCE', reference: 'synthetic-facts#required-fact' }],
      }],
    },
  },
  context: exampleScope,
  reliance_purpose: 'CURRENT_OPERATIONAL',
  as_of: '2040-06-15',
  trusted_external_evaluations: [{
    evidence_package_sha256: exampleCompletenessProof.sha256,
    rule_id: exampleCompletenessProof.rule_id,
    evaluator_id: exampleCompletenessProof.evaluator_id,
    authority_id: exampleCompletenessProof.authority_id,
    outcome: 'SATISFIED',
  }],
});

export const PUBLIC_COMPARATIVE_ANALYSIS_EXAMPLE = Object.freeze({
  entry: {
    key: 'SYNTHETIC_COMPARATIVE_ENTRY_2040',
    origin: { type: 'OWNER_DECLARATION', date: '2040-01-01' },
    verification_state: 'UNCONFIRMED',
    currency: 'UNKNOWN',
    authority_status: 'UNKNOWN',
    expiry_status: 'UNKNOWN',
    scope: exampleScope,
  },
  context: exampleScope,
  reliance_purpose: 'COMPARATIVE_ANALYSIS',
});
