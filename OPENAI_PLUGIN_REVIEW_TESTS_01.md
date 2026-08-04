# OpenAI plugin reviewer tests 01

Prepared: 2026-08-04

Tool for every case: `assess_normative_reliance`

Setup for every case: no authentication. Connect to `https://norms.beforebabel.org/mcp` as a Universal Streamable HTTP MCP server. The canonical schema comes only from `tools/list`; a human-readable copy and the base examples are at https://norms.beforebabel.org/input-contract.

The executable source of these exact cases is `test/mcp-submission-cases.mjs`. It constructs complete arguments, invokes the real MCP transport and asserts exactly five positive and three negative results. It is public at https://github.com/Angeliasrl/norms-mcp-engine/blob/mcp/openai-submission-server-01/test/mcp-submission-cases.mjs. The base positive fixture below is complete and schema-valid. P2, P3 and P5 intentionally reuse it unchanged because each isolates a different returned invariant. N1–N3 specify complete, deterministic transformations of that fixture. P4 uses the complete public Audit 02 fixture and the canonical mapping implemented by `toolArgumentsFromFixture` in `test/mcp-test-helpers.mjs`.

## Copyable base fixture for P1, P2, P3, P5 and N1–N3

```json
{
  "entry": {
    "key": "SYNTHETIC_PUBLIC_ENTRY_2040",
    "origin": { "type": "SOURCE_DOCUMENT", "date": "2039-12-15" },
    "verification_state": "RATIFIED",
    "currency": "CURRENT",
    "authority_status": "VALID",
    "expiry_status": "ACTIVE",
    "ratification": {
      "date": "2039-12-15",
      "document": "synthetic-public-contract.json",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "section_id": "synthetic-section-01"
    },
    "scope": {
      "subject": ["SYNTHETIC_SUBJECT"],
      "jurisdiction": ["SYNTHETIC_JURISDICTION"],
      "applicable_operations": ["SYNTHETIC_OPERATION"]
    },
    "effective_interval": { "from": "2040-01-01", "until_exclusive": "2041-01-01" },
    "normative_unit": {
      "instrument": "SYNTHETIC_INSTRUMENT_2040",
      "provision": "SYNTHETIC_PROVISION_01"
    },
    "provision_segmentation": { "status": "SEGMENTED" },
    "applicability": { "from": "2040-01-01", "until_exclusive": "2041-01-01" },
    "applicability_conditions": {
      "completeness": "COMPLETE",
      "completeness_evaluation": {
        "mode": "EXTERNAL_EVALUATION_REQUIRED",
        "evaluation": {
          "outcome": "SATISFIED",
          "verification_state": "RATIFIED",
          "evidence": [{ "type": "DOCUMENT_REFERENCE", "reference": "synthetic-condition-contract#complete" }],
          "ratification": {
            "date": "2039-12-15",
            "document": "synthetic-public-contract.json",
            "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "section_id": "synthetic-condition-contract",
            "rule_id": "SYNTHETIC_COMPLETENESS_RULE",
            "evaluator_id": "SYNTHETIC_EVALUATOR",
            "authority_id": "SYNTHETIC_AUTHORITY"
          }
        }
      },
      "conditions": [{
        "id": "SYNTHETIC_REQUIRED_FACT",
        "evaluation_mode": "ENGINE_EVALUATED",
        "predicate": { "operator": "BOOLEAN_IS", "left_fact": "required_fact", "right_value": true },
        "facts": { "required_fact": true },
        "evidence": [{ "type": "DOCUMENT_REFERENCE", "reference": "synthetic-facts#required-fact" }]
      }]
    }
  },
  "context": {
    "subject": ["SYNTHETIC_SUBJECT"],
    "jurisdiction": ["SYNTHETIC_JURISDICTION"],
    "applicable_operations": ["SYNTHETIC_OPERATION"]
  },
  "reliance_purpose": "CURRENT_OPERATIONAL",
  "as_of": "2040-06-15",
  "trusted_external_evaluations": [{
    "evidence_package_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "rule_id": "SYNTHETIC_COMPLETENESS_RULE",
    "evaluator_id": "SYNTHETIC_EVALUATOR",
    "authority_id": "SYNTHETIC_AUTHORITY",
    "outcome": "SATISFIED"
  }]
}
```

## Five positive tests

### P1 — complete CURRENT_OPERATIONAL

- User prompt: “Assess this complete synthetic record for CURRENT_OPERATIONAL reliance. Always show blocking, unknown and unexamined.”
- Fixture: paste the complete base fixture unchanged.
- Expected behavior: validate the typed input and assess only its structured grounds.
- Expected result shape: `purpose_assessment.authorizes_current_operational: true`, `admissible: true`, `eligible: true`, `blocking: []`, `unknown: []`, `unexamined: false`.
- PASS: all fields above match and no broader legal conclusion appears. FAIL: any inferred input, missing field, non-schema output or overclaim.
- Setup/time: none; target under 5 seconds.

### P2 — atomic condition satisfied

- User prompt: “Evaluate the explicitly structured atomic condition and report its evidence basis.”
- Fixture: paste the complete base fixture unchanged.
- Expected behavior: evaluate `required_fact` through the declared `BOOLEAN_IS` predicate; ignore free text.
- Expected result shape: P1 shape plus `conditions_satisfied: true` and first condition result `basis: ENGINE_DERIVED`.
- PASS: the condition is satisfied only from the atomic fact. FAIL: prose contributes or the basis differs.
- Setup/time: none; target under 5 seconds.

### P3 — date inside interval

- User prompt: “Assess temporal applicability at 2040-06-15 within the declared interval.”
- Fixture: paste the complete base fixture unchanged.
- Expected behavior: compare `as_of` with the structured applicability interval.
- Expected result shape: P1 shape plus `applicability_matches: true`.
- PASS: interval membership is true and all other gates remain explicit. FAIL: the date is inferred from text or interval logic diverges.
- Setup/time: none; target under 5 seconds.

### P4 — minimized real Italian threshold predicate

- User prompt: “Using the structured Audit 02 fixture, assess only whether SUPPLY and EUR 12,816 excluding VAT satisfy the ratified type-and-threshold predicate at 2024-01-27. Do not assess overall legality.”
- Fixture: copy the complete JSON from https://github.com/Angeliasrl/norms-mcp-engine/blob/mcp/openai-submission-server-01/evidence/NORMS_ITALIAN_PUBLIC_PROCUREMENT_AUDIT_02_DIRECT_AWARD_THRESHOLD/fixtures/direct-award-threshold-audit-01.json and submit its `entry`, `context`, `evaluation_date` as `as_of`, `CURRENT_OPERATIONAL` as `reliance_purpose`, and `trust.trusted_external_evaluations` as top-level `trusted_external_evaluations`. No expected reference or dispositive text is included.
- Expected behavior: assess only the modeled supply/type and strictly-below-140000 predicate.
- Expected result shape: same positive fields as P1.
- PASS: positive limited predicate with no overall-legality statement. FAIL: contamination from the authority’s outcome or a wider legal conclusion.
- Setup/time: public fixture only; target under 5 seconds.

### P5 — deterministic repetition

- User prompt: “Run the same complete structured assessment twice and compare the full MCP results.”
- Fixture: paste the complete base fixture unchanged for both calls.
- Expected behavior: execute two independent calls without adding timestamps or request identifiers to the tool result.
- Expected result shape: both P1-positive results are deeply structurally identical.
- PASS: deep equality of the complete returned MCP result. FAIL: any structural difference.
- Setup/time: two calls; target under 10 seconds.

## Three negative tests

### N1 — unknown authority

- Scenario/prompt: “Assess the otherwise complete record with unknown authority; do not treat an empty blocker list as authorization.”
- Complete fixture construction: paste the base fixture and replace only `entry.authority_status` with `"UNKNOWN"`.
- Safe behavior: no authorization; preserve the unknown gate.
- Essential output: `authorizes_current_operational: false`, `admissible: false`, `unknown` contains `authority.unknown`, `unexamined: true`.
- Why: authority is required and was not verified.
- PASS: all essential fields match even if `blocking` is empty. FAIL: authorization or invented authority.

### N2 — selected provision absent

- Scenario/prompt: “Assess this instrument after the selected provision has been removed.”
- Complete fixture construction: paste the base fixture and remove only `entry.normative_unit.provision`.
- Safe behavior: fail closed without falling back to the whole instrument.
- Essential output: no authorization; `unknown` contains `normative_unit.provision_missing`.
- Why: a selected provision is a required ground.
- PASS: precise missing-provision outcome. FAIL: fallback, inference or authorization.

### N3 — fact only in free text

- Scenario/prompt: “Assess this record where the required fact appears only in display text.”
- Complete fixture construction: paste the base fixture, remove `entry.applicability_conditions.conditions[0].facts.required_fact`, and add `entry.value: "required_fact=true; FREE TEXT MUST NOT BE EVIDENCE"`.
- Safe behavior: reject/fail closed; do not infer the fact from `value`.
- Essential output: sanitized MCP error containing `CONDITION_FACT_MISSING`; no authorization, stack trace or local path.
- Why: display text is not atomic evidence.
- PASS: the missing fact is reported and text is ignored. FAIL: the condition becomes satisfied or authorized.

## Fixture validation

The base fixture is the exported `PUBLIC_CURRENT_OPERATIONAL_EXAMPLE` and is validated against the same canonical Zod schema used by the tool in `test/mcp-public-input-contract.mjs` and `test/public-pages-worker.mjs`. The executable 5+3 variants traverse the actual MCP transport in `test/mcp-submission-cases.mjs`; `npm test` includes all three checks. No document in this package defines an alternative input schema.
