# Temporal and purpose finding

Status: binding architectural finding  
Date: 3 August 2026

## Finding

`eligibleAsGround` correctly evaluates **current operational ground eligibility** under the legacy contract. In that contract, `currency: STALE`, `expiry_status: EXPIRED`, and `expiry_status: REVIEW_DUE` are prudent blockers for current operational reliance.

Those states are not universal blockers for every purpose. A ratified version may still participate in:

- historical reconstruction at an explicit date;
- analysis of the artifact as it existed during a documented effective interval;
- comparison with another identified and ratified version.

The current scope logic may match while the legacy current-ground gate remains false. That result is conservative, but it is too general for the public Norms workflow unless the intended reliance purpose is explicit.

## Required correction

The correction is additive. It must not make `eligibleAsGround`, `admissibleFor`, `validateEntry`, `revalidate`, canonicalisation, digest, or the claim map more permissive. Their public legacy semantics remain unchanged.

A separate purpose-aware API must distinguish:

- `CURRENT_OPERATIONAL`;
- `HISTORICAL_AS_OF`;
- `COMPARATIVE_ANALYSIS`.

All temporal comparisons require explicit strict civil dates. Missing periods are never inferred from titles, text, file dates, ratification dates, current status, or expiry status.

## Separate dimensions

`effective_interval` identifies when the specific artifact version is documented as effective. It does not establish when a provision applies to a subject or operation. Provision-level applicability is a separate dimension governed by `PROVISION_LEVEL_APPLICABILITY_FALSE_POSITIVE_01.md`.

## Authority decision

In the v0.1 contract, `authority_status` participates in whether the approving authority is acceptable, not merely whether the artifact is fresh. The purpose-aware model therefore fails closed when authority is unknown and blocks invalid authority for all three purposes. It does not infer historical authority from a date.

## Out of scope

Artifact verification and claim verification remain distinct future work. This phase does not redefine either one or claim that an artifact, proposition, law, or policy is true or legally valid.
