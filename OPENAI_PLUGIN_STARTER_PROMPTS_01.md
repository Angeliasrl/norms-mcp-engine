# OpenAI plugin starter prompts 01

Prepared: 2026-08-04

These prompts assume that the user supplies an object conforming to the canonical schema exposed by `assess_normative_reliance` and documented at https://norms.beforebabel.org/input-contract.

1. Assess this complete, ratified record for `CURRENT_OPERATIONAL` reliance at the supplied `as_of` date. Show the limited authorization result and always list `blocking`, `unknown` and `unexamined`.
2. Evaluate whether this explicitly structured atomic condition is satisfied by the verified fact supplied in the record. Do not use the `value` field as evidence.
3. Assess this ratified record for `HISTORICAL_AS_OF` at the declared date and explain whether that date is within its structured applicability interval.
4. Compare this structured record using `COMPARATIVE_ANALYSIS`, without an `as_of` value, and identify every unknown or unexamined area without turning an empty blocker list into authorization.
5. Explain why this structured record is not authorizable for its declared purpose, distinguishing explicit blockers from unknown and unexamined grounds.

Do not adapt these prompts into requests to analyze PDFs, retrieve laws, approve contracts, provide legal advice or assess overall legal conformity.
