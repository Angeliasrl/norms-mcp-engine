# ENGINE_RUN_AND_COMPARISON_01

- phase verdict: `PASS_REAL_LIMITED_PREDICATE`
- engine outcome: `CURRENT_OPERATIONAL_AUTHORIZED_FOR_LIMITED_PREDICATE`
- comparison status: `CONSISTENT_WITH_EXPECTED_REFERENCE_WITHIN_LIMITED_PREDICATE`
- model semantic changes: none

## Question

At 27 January 2024, do the independently structured facts
`contract_type=SUPPLY` and `amount_excluding_vat_eur=12816` satisfy the modeled
objective type-and-threshold predicate of the ratified historical unit D.Lgs.
36/2023 article 50(1)(b), with every `CURRENT_OPERATIONAL` gate satisfied?

## Expected external reference

The official determination records that the Camera di Commercio adopted the
mode described in the act while citing article 50(1)(b). This dispositive fact
is an external comparison reference only and is absent from the engine input.

## Authorized wording if all gates pass

“Il caso soddisfa il predicato modellato relativo al tipo di contratto e alla
soglia dell’articolo 50, comma 1, lettera b).”

No broader legal conclusion is permitted. In particular, the run does not
establish overall legality, correct contractor selection, complete general
requirements, economic congruity, or compliance with every Code principle and
obligation.

## Real assessment output

| Property | Value |
|---|---|
| `authorizes_current_operational` | `true` |
| `admissible` | `true` |
| `blocking` | `[]` |
| `unknown` | `[]` |
| `unexamined` | `false` |
| `applicability_matches` | `true` |
| `scope_matches` | `true` |
| `eligible` | `true` |
| condition outcome | `SATISFIED / ENGINE_DERIVED` |
| structural determinism | `PASS` |

## Boundary matrix

| Case | Result |
|---|---|
| EUR 139,999.99, `SUPPLY` | authorized for the limited predicate |
| EUR 140,000.00 | fail-closed: condition not satisfied |
| EUR 140,000.01 | fail-closed: condition not satisfied |
| `WORKS` | fail-closed: condition not satisfied |
| amount `UNKNOWN` | fail-closed: condition unknown |
| amount absent | rejected: `CONDITION_FACT_MISSING` |
| amount only in `value` | rejected: `CONDITION_FACT_MISSING`; no inference |
| provision removed | fail-closed: provision unknown |
| unit unratified | fail-closed: verification blocker |
| 2023-06-30, before applicability | fail-closed: temporal and applicability mismatch |

Test result: 11 tests passed; 2 positive assessments (the real case and the
required EUR 139,999.99 boundary), 7 fail-closed assessments, 2 rejected
inputs.

## Repository gates

- full `npm test`: PASS (`suite.mjs` 93; condition-evidence 18; procurement
  negative 14; synthetic positive 9; audit 02 11; claim-map sync PASS)
- each requested matrix rerun independently: PASS
- `node --check`: PASS
- `git diff --check`: PASS
- dedicated typecheck: `NON CONFIGURATO`
- dedicated linter: `NON CONFIGURATO`
