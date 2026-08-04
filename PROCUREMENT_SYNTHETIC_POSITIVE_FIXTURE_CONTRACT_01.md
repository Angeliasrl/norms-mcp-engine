# PROCUREMENT_SYNTHETIC_POSITIVE_FIXTURE_CONTRACT_01

Status: synthetic engine test contract

Phase: `PROCUREMENT_DETERMINISTIC_APPLICABILITY_POSITIVE_SYNTHETIC_01`

Date: 4 August 2026

## Purpose

This fixture proves only that the existing `assessRelianceForPurpose` API can
produce a deterministic positive `CURRENT_OPERATIONAL` assessment when every
required gate is explicitly supplied and satisfied.

It does not represent, interpret, approximate, or provide advice about any real
legal instrument. It contains no real authority, administration, identifier,
legislative reference, procurement procedure, or source-derived date.

## Synthetic identifiers

- Instrument: `SYNTHETIC_PUBLIC_WORKS_PRICE_LIST_2032`
- Provision: `SYNTHETIC_PROVISION_APPLICABILITY_01`
- Authority: `SYNTHETIC_AUTHORITY_01`
- Scope: `SYNTHETIC_PUBLIC_WORKS_SCOPE_01`
- Operation: `SYNTHETIC_OPERATION_01`
- Condition: `SYNTHETIC_REQUIRED_FACT_01`

These labels are test tokens only. They do not name or encode real institutions
or rules.

## Synthetic dates

- Applicability starts: `2032-01-01`
- Applicability ends after `2032-12-31`; the model represents this with the
  end-exclusive bound `2033-01-01`
- Evaluation date: `2032-06-15`

Every date is an invented test boundary. None is `ORDINARY_FROM`, derived from
a source, or asserted to describe a real rule.

## Positive gates

The positive fixture explicitly supplies:

- ratified record verification and proof;
- current currency, valid authority, and active expiry status;
- matching synthetic scope and context;
- an identified synthetic instrument and provision;
- `SEGMENTED` provision status;
- known matching artifact and provision intervals;
- separately ratified synthetic condition completeness;
- a typed boolean fact evaluated by the closed predicate DSL;
- structured synthetic evidence for that fact.

The `value` field states only that it is ignored. No gate is read or inferred
from it.

## Decision boundary

The positive fixture must produce:

- `authorizes_current_operational: true`;
- `admissible: true`;
- `blocking: []`;
- `unknown: []`;
- `unexamined: false`.

Eight adjacent cases change only the relevant fixture field or request context
and must remain non-authorizing: before interval, after interval, unknown fact,
false fact, scope mismatch, unconfirmed record, missing provision, and condition
present only in free text.

This synthetic success does not resolve any item in
`PROCUREMENT_APPLICABILITY_OPEN_DECISIONS_01.md` and creates no claim about a
real procurement rule.
