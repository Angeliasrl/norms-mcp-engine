# STRUCTURED_FIXTURE_CONTRACT_01

The fixture `direct-award-threshold-audit-01.json` is a frozen input contract
for one limited objective predicate. Its engine-evaluated condition is:

```text
contract_type = SUPPLY
AND amount_excluding_vat_eur < 140000
```

All remaining `CURRENT_OPERATIONAL` gates are explicit: selected provision,
segmentation, effective and applicability interval, evaluation date, verified
authority, matching scope, ratified entry, ratified completeness contract and
current-ground eligibility.

The condition facts cite the official act extraction as evidence. The
threshold and contract-type branch come from the selected Normattiva unit. The
`value` field is an inert marker and contains no fact, threshold, expected
outcome, dispositive or interpretive statement.

The expected reference is deliberately absent from the JSON. It is recorded
only in `ENGINE_RUN_AND_COMPARISON_01.md` after execution.

An unknown amount is represented by an externally evaluated `UNKNOWN`
condition because the current closed predicate DSL does not admit an unknown
atomic scalar. A missing amount is rejected with `CONDITION_FACT_MISSING`.
Both behaviors are fail-closed and do not change model semantics.
