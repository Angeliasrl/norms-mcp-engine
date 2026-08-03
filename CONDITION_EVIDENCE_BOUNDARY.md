# Condition evidence boundary

Purpose-aware reliance uses a closed, deterministic condition model. Callers provide atomic facts and predicates, or a separately ratified external evaluation. They cannot provide an authoritative aggregate condition verdict.

## Trusted bases

- `ENGINE_DERIVED`: the engine evaluated a closed predicate over typed facts.
- `EXTERNALLY_RATIFIED`: an external outcome carries evidence, evaluator and authority identity, rule identity, and a valid evidence-package digest.

`CALLER_ASSERTED_UNCONFIRMED`, `MISSING`, and `UNSUPPORTED` never contribute to current operational authorization.

Condition completeness must itself have a trusted basis. `COMPLETE` without a ratified applicability contract or externally ratified completeness evaluation fails closed. Empty conditions never mean that no conditions apply.

The DSL supports typed equality, inequality, set membership, booleans, numbers, thresholds, civil dates, intervals, `ALL`, `ANY`, and `NOT`. It has no textual expressions, coercion, dynamic code, I/O, or fetch. Unsupported legal judgment must use external evaluation and fails closed unless ratified.

Legacy records using `applicability_conditions.status` are not automatically converted.
