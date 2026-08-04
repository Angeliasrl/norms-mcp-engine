# MCP public tool contract 01

Status: local read-only implementation; not deployed publicly.

## Server

- Name: `norms-structured-applicability`
- Version: `0.1.0`
- Transport: Streamable HTTP
- Local endpoint: `POST /mcp`
- Tools exposed: exactly one

Server instructions require structured records and facts, forbid inference from
free text and general legal-compliance claims, require display of `blocking`,
`unknown`, and `unexamined`, distinguish not-examined from satisfied, and state
that an empty blocker list alone is not authorization.

## Tool

Name: `assess_normative_reliance`

Title: `Assess normative reliance`

Description:

> Assess whether a structured normative record may be relied upon for a
> specified purpose. Returns explicit blockers, unknowns and unexamined areas.
> It does not retrieve laws, parse documents, infer legal conditions from free
> text, provide legal advice or certify overall compliance.

The handler delegates directly to the canonical `assessRelianceForPurpose`
function. It contains no applicability, condition, eligibility, blocking,
unknown, or unexamined logic of its own.

Annotations:

| Annotation | Value | Reason |
|---|---:|---|
| `readOnlyHint` | `true` | Computes a result without mutating records or starting jobs. |
| `openWorldHint` | `false` | Makes no external calls and changes no public state. |
| `destructiveHint` | `false` | Deletes, overwrites, sends and revokes nothing. |

## Input schema

Required:

- `entry`: structured normative entry supported by the engine;
- `context`: structured scope context;
- `reliance_purpose`: `CURRENT_OPERATIONAL`, `HISTORICAL_AS_OF`, or
  `COMPARATIVE_ANALYSIS`.

Optional:

- `as_of`: strict civil date `YYYY-MM-DD` where required by the purpose;
- `trusted_external_evaluations`: at most 64 explicit trust-registry records
  supported by the condition-evidence contract.

The schema accepts JSON data only. It has no PDF, binary, URL-fetch,
conversation, expected-outcome, or gate-override field. A supported `value`
field remains non-evidentiary free text and is never parsed by the tool.

Example input (shape abbreviated; all engine-required entry gates still apply):

```json
{
  "entry": { "key": "SYNTHETIC_UNIT_01", "verification_state": "RATIFIED" },
  "context": { "subject": ["SYNTHETIC_SCOPE_01"] },
  "reliance_purpose": "CURRENT_OPERATIONAL",
  "as_of": "2032-06-15",
  "trusted_external_evaluations": []
}
```

## Output schema

Successful calls return both:

- `structuredContent`, containing the complete canonical
  `current_operational_ground` and `purpose_assessment` objects;
- one concise text summary containing admissibility, current-operational
  authorization, blockers, unknowns, unexamined state, and the bounded-purpose
  disclaimer.

The output schema declares every structured field, including `eligible`,
`admissible`, `authorizes_current_operational`, `blocking`, `unknown`,
`unexamined`, temporal and applicability results, scope results, verification
status, condition completeness/results, normative-unit selection and
segmentation.

## Error contract

Schema-invalid MCP arguments are rejected by the SDK protocol layer. Inputs that
pass the transport schema but fail canonical engine validation return:

```text
NORMS_INPUT_INVALID:<STABLE_ENGINE_CODE>. The structured input was rejected; no assessment was produced.
```

with `isError: true`, no `structuredContent`, stack trace, local path, payload,
or inferred assessment. Unexpected handler failures use
`NORMS_INPUT_INVALID:INVALID_STRUCTURED_INPUT` without internal details.

This contract is an assessment interface, not legal advice or certification of
overall compliance.
