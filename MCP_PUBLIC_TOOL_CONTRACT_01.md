# MCP public tool contract 01

Status: deployed read-only implementation.

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

The `inputSchema` returned by `tools/list` is the sole canonical public input
contract. It is generated from `server/public-input-contract.mjs` and declares
strict decision objects, reusable definitions and references, required fields,
enums, bounded facts and evidence, and the three purpose-specific `as_of`
branches. This document deliberately does not reproduce that schema.

Schema-invalid arguments are rejected before the engine runs. The only
intentionally extensible decision input is the atomic-fact map: fact names are
record keys and every value is a bounded string, finite number, or boolean.
Unknown properties at the request, entry, context and decision-object levels
are rejected.

The public `/input-contract` page renders examples from exported constants that
the automated suite validates against this same canonical schema. There is no
manual abbreviated example here that can drift from the wire contract.

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

Schema-invalid MCP arguments are rejected by the SDK protocol layer with the
field path, violated constraint and allowed enum values where applicable.
Ordinary missing gate fields are therefore not reduced to `MISSING_KEY`.
Cross-field constraints that cannot be fully expressed by JSON Schema continue
through canonical engine validation and return:

```text
NORMS_INPUT_INVALID:<STABLE_ENGINE_CODE>. The structured input was rejected; no assessment was produced.
```

with `isError: true`, no `structuredContent`, stack trace, local path, payload,
or inferred assessment. Unexpected handler failures use
`NORMS_INPUT_INVALID:INVALID_STRUCTURED_INPUT` without internal details.

This contract is an assessment interface, not legal advice or certification of
overall compliance.
