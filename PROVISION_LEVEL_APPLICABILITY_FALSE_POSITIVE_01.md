# PROVISION_LEVEL_APPLICABILITY_FALSE_POSITIVE_01

Status: binding publication blocker  
Date: 3 August 2026

## Observed false positive

The previous public runtime returned all of the following for a current compliance assessment concerning obligations for Annex I high-risk AI systems:

- `eligible: true`;
- `admissible: true`;
- `scope_matches: true`.

The supplied record also explicitly stated an assessment date of 2026-08-03, an official application date of 2028-08-02, and that the obligations were not yet applicable. A sibling check for an already applicable obligation from the same instrument produced the same verdict.

This demonstrates a conflation between:

- validity and currency of the source instrument;
- applicability of the selected provision;
- concrete applicability to the declared subject and operation.

## First patch review failure

The first uncommitted purpose-aware patch still allowed a current record with matching scope and no temporal interval to produce:

- `admissible: true`;
- `temporal_known: false`;
- `authorizes_current_operational: true`.

It also used `effective_interval` as its only temporal dimension. That is insufficient: the artifact interval is not the provision applicability interval.

## Binding model correction

An instrument may be current while a provision:

- is not yet applicable;
- is no longer applicable;
- depends on conditions that have not been verified.

`CURRENT_OPERATIONAL` must therefore fail closed unless the selected normative unit, provision segmentation, provision applicability interval, applicability conditions, authority, verification, current-ground eligibility, and scope are all known and acceptable.

A whole instrument with staggered provisions may be used as reference or may participate in historical or comparative analysis, but it must not authorize a current operational decision without selecting the relevant provision. The engine does not segment an instrument or interpret legal conditions from free text.

`COMPARATIVE_ANALYSIS` may tolerate a missing artifact effective interval. It must not tolerate unknown authority, missing or unknown scope, an unconfirmed record, or an unidentified comparison unit.

No value may be inferred from `value` or other free text. No current operational authorization may be derived from an incomplete blocker list; it must be the explicit conjunction of every required gate.

## Release gate

No MCP integration, deployment, or OpenAI submission is permitted until the canonical 2025/2028/non-segmented regression matrix passes and an independent review finds no fail-open path.
