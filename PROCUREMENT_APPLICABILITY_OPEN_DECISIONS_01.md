# PROCUREMENT_APPLICABILITY_OPEN_DECISIONS_01

Status: OPEN — implementation blockers

Phase: `PROCUREMENT_DETERMINISTIC_APPLICABILITY_NEGATIVE_MATRIX_01`

Date: 4 August 2026

## Boundary of this phase

This phase adds only deterministic negative tests for provision-level
applicability under `CURRENT_OPERATIONAL`. It does not encode a real procurement
rule, create a positive fixture for the Regione Lombardia price list, interpret
legal conditions, infer values from free text, or choose between temporal
regimes.

The dates and identifiers in the negative test fixture are synthetic test
inputs. They are not normative claims and do not establish applicability or
completeness for a real instrument.

## Open decisions

### 1. Ratification of `ORDINARY_FROM`

Status: **OPEN**

No start date for the ordinary applicability window is introduced by this
phase. A future positive fixture requires an explicitly identified documentary
basis and ratification. It must not infer the start from a title, calendar year,
approval date, publication date, file date, or free text.

### 2. Representation and selection of the two temporal regimes

Status: **OPEN**

The current entry model has one provision applicability interval and one
condition block. A binding decision is still required on how to represent the
ordinary and transitional regimes and how the engine, rather than an unchecked
caller assumption, selects the applicable regime.

### 3. Representation of an unknown atomic fact

Status: **OPEN**

The closed predicate DSL currently rejects a missing referenced fact with
`CONDITION_FACT_MISSING`. Separately, an unconfirmed external evaluation can
produce an unknown, non-authorizing condition result. A future model decision
must determine whether and how a typed atomic fact may itself be represented as
unknown without creating a fail-open path.

### 4. Completeness declaration for the normative caveat

Status: **OPEN**

This phase makes no completeness declaration concerning the real procurement
discipline or its referenced caveat. A future positive fixture requires a
ratified applicability contract or a separately ratified completeness
evaluation. The engine must not derive completeness from prose or from the
absence of additional structured conditions.

## Gate

Until all four decisions are resolved by explicit, reviewable acts, no real
`CURRENT_OPERATIONAL` positive procurement fixture is permitted. Negative test
success does not resolve these decisions and does not establish a legal claim.

## Synthetic positive test boundary

`PROCUREMENT_DETERMINISTIC_APPLICABILITY_POSITIVE_SYNTHETIC_01` exercises the
existing positive engine path with artificial identifiers, dates, facts, scope,
and evidence. It is not a model of the real price list and does not supply,
ratify, or imply any fact needed by the four decisions above. All four decisions
remain **OPEN**.
