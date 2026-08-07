const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

const scope = {
  subject: ['SYNTHETIC_DEMO_SUBJECT_01'],
  jurisdiction: ['SYNTHETIC_DEMO_JURISDICTION_01'],
  applicable_operations: ['SYNTHETIC_DEMO_OPERATION_01'],
};

const completenessRatification = {
  date: '2040-01-01',
  document: 'positive-current-operational-demo-01-condition-contract.json',
  sha256: 'd'.repeat(64),
  section_id: 'synthetic-demo-condition-completeness-01',
  rule_id: 'SYNTHETIC_DEMO_COMPLETENESS_RULE_01',
  evaluator_id: 'SYNTHETIC_DEMO_EVALUATOR_01',
  authority_id: 'SYNTHETIC_DEMO_AUTHORITY_01',
};

export const POSITIVE_CURRENT_OPERATIONAL_DEMO_01 = deepFreeze({
  fixture_id: 'POSITIVE_CURRENT_OPERATIONAL_DEMO_01',
  fixture_version: 1,
  synthetic_notice: 'Fixed public synthetic demonstration data only. It does not represent legal advice, real-world facts, or a compliance certification.',
  request: {
    entry: {
      key: 'SYNTHETIC_POSITIVE_CURRENT_OPERATIONAL_DEMO_UNIT_01',
      value: 'SYNTHETIC_DISPLAY_TEXT_NOT_USED_AS_NORMATIVE_EVIDENCE',
      origin: { type: 'SOURCE_DOCUMENT', date: '2040-01-01' },
      verification_state: 'RATIFIED',
      currency: 'CURRENT',
      authority_status: 'VALID',
      expiry_status: 'ACTIVE',
      ratification: {
        date: '2040-01-01',
        document: 'positive-current-operational-demo-01-record.json',
        sha256: 'c'.repeat(64),
        section_id: 'synthetic-demo-normative-unit-01',
      },
      scope,
      effective_interval: { from: '2000-01-01' },
      normative_unit: {
        instrument: 'SYNTHETIC_DEMO_INSTRUMENT_01',
        provision: 'SYNTHETIC_DEMO_PROVISION_01',
        classification_basis: 'SYNTHETIC_DEMO_CLASSIFICATION_BASIS_01',
      },
      provision_segmentation: { status: 'SEGMENTED' },
      applicability: { from: '2000-01-01' },
      applicability_conditions: {
        completeness: 'COMPLETE',
        completeness_evaluation: {
          mode: 'EXTERNAL_EVALUATION_REQUIRED',
          evaluation: {
            outcome: 'SATISFIED',
            verification_state: 'RATIFIED',
            evidence: [{
              type: 'DOCUMENT_REFERENCE',
              reference: 'positive-current-operational-demo-01-condition-contract.json#complete',
            }],
            ratification: completenessRatification,
          },
        },
        conditions: [],
      },
    },
    context: scope,
    reliance_purpose: 'CURRENT_OPERATIONAL',
    as_of: '2040-06-15',
  },
  options: {
    trusted_external_evaluations: [{
      evidence_package_sha256: completenessRatification.sha256,
      rule_id: completenessRatification.rule_id,
      evaluator_id: completenessRatification.evaluator_id,
      authority_id: completenessRatification.authority_id,
      outcome: 'SATISFIED',
    }],
  },
});

export const positiveCurrentOperationalDemoInputs = () => ({
  request: structuredClone(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.request),
  options: structuredClone(POSITIVE_CURRENT_OPERATIONAL_DEMO_01.options),
});
