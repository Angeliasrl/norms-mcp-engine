# Temporal and provision applicability test matrix

Status: required before final implementation  
Date: 3 August 2026

The matrix uses synthetic minimal records. It contains descriptive references only and no complete legislative text.

| ID | Purpose and condition | Required result |
|---|---|---|
| P0-1 | Current operational; same current instrument; selected provision applies from 2025-02-02; assessment 2026-08-03 | admissible and current authorization true |
| P0-2 | Current operational; same instrument and authority; selected provision applies from 2028-08-02; assessment 2026-08-03 | applicability known, mismatch, admissible false, current authorization false |
| P0-3 | Current operational; whole staggered instrument; segmentation required | `requires_provision_segmentation: true`, admissible false |
| P0-4 | Current, ratified, valid authority, matching scope, no applicability interval | applicability unknown, admissible false, current authorization false |
| C-1 | Applicability conditions `NONE` | may proceed when all other gates pass |
| C-2 | Conditions `SATISFIED` with valid structured evidence | may proceed when all other gates pass |
| C-3 | Conditions `SATISFIED` without evidence | validation error |
| C-4 | Conditions `NOT_SATISFIED` | admissible false |
| C-5 | Conditions `UNKNOWN` | admissible false |
| C-6 | Conditions absent | conditions unknown, admissible false |
| B-1 | `as_of == applicability.from` | included |
| B-2 | `as_of == applicability.until_exclusive` | excluded |
| B-3 | Inverted interval | validation error |
| B-4 | Invalid civil date or timestamp | validation error |
| CMP-1 | Comparative; stale; effective interval absent; authority and scope known | comparative admission true; no current or historical authorization |
| CMP-2 | Comparative; authority unknown | fail closed |
| CMP-3 | Comparative; scope missing | fail closed |
| CMP-4 | Comparative; unconfirmed | fail closed |
| H-1 | Historical; ratified artifact; known effective interval; date inside; scope and authority known | historical admission true; current authorization false |
| H-2 | Historical date outside artifact interval | temporal mismatch and fail |
| H-3 | Historical effective interval missing | temporal unknown and fail |
| H-4 | Historical applicability question with applicability interval | artifact time and provision applicability reported separately |
| INV-1 | Every current authorization | implies all required known/match/satisfaction flags and no segmentation requirement |
| INV-2 | Current conditions unknown | never admissible |
| INV-3 | Current segmentation required | never admissible |
| LEG-1 | All original tests | unchanged expected results and pass |
| LEG-2 | Legacy record without new fields | legacy canonical digest unchanged |
| DET-1 | Same explicit input under different system dates | identical output |

## Required invariant

For `CURRENT_OPERATIONAL`, `authorizes_current_operational` is the explicit conjunction of:

- current-ground eligibility;
- known and matching scope;
- known and matching artifact time;
- known and matching provision applicability;
- known and satisfied applicability conditions;
- identified normative unit and provision;
- acceptable provision segmentation;
- no blocking or unknown gate.

The test suite must mutate each conjunct independently to a failing or unknown value and prove that authorization becomes false.
