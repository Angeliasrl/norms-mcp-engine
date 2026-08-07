# Purpose-aware temporal and provision reliance model

Status: architecture branch candidate  
Date: 3 August 2026

## Compatibility boundary

`eligibleAsGround` remains the **current operational ground eligibility** gate defined by v0.1. `admissibleFor`, `validateEntry`, `revalidate`, canonicalisation, digest, and the claim map retain their legacy behavior for legacy records. The new API is additive:

```js
import {
  RELIANCE_PURPOSE,
  assessRelianceForPurpose,
} from 'norms-mcp-engine/model';
```

`assessRelianceForPurpose` validates the entry first, never mutates it, performs no I/O, does not read the system clock, and does not infer missing values.

## Separate dimensions

### Instrument status

The legacy fields `currency`, `authority_status`, and `expiry_status` describe current instrument or artifact status. Results group them under `instrument_status`. A current instrument does not make every provision currently applicable.

### Artifact version time

```json
{
  "effective_interval": {
    "from": "YYYY-MM-DD",
    "until_exclusive": "YYYY-MM-DD"
  }
}
```

This is the documented period of effectiveness or temporal identification of the specific artifact version. It is `[from, until_exclusive)`. It is never inferred from status, ratification, titles, free text, or file dates.

### Normative unit

```json
{
  "normative_unit": {
    "instrument": "Synthetic Regulation 2024/0001",
    "provision": "Chapter III, synthetic unit",
    "classification_basis": "Synthetic classification basis"
  }
}
```

`instrument` is required whenever the block is present. Current operational and comparative reliance additionally require an explicit `provision`. The engine never extracts these values from `value` or any other free text.

### Provision applicability

```json
{
  "applicability": {
    "from": "YYYY-MM-DD",
    "until_exclusive": "YYYY-MM-DD"
  }
}
```

This interval is separate from artifact effectiveness. Its bounds use strict civil dates and are end-exclusive. Missing applicability is unknown, not evidence of applicability.

### Conditions

```json
{
  "applicability_conditions": {
    "status": "SATISFIED",
    "evidence": [
      {
        "type": "DOCUMENT_REFERENCE",
        "reference": "Synthetic record section 2"
      }
    ]
  }
}
```

Statuses are `NONE`, `SATISFIED`, `NOT_SATISFIED`, and `UNKNOWN`. `SATISFIED` requires at least one structured evidence item. Evidence types are `DOCUMENT_REFERENCE`, `USER_DECLARATION`, and `EXTERNAL_VERIFICATION`. The type describes the evidence supplied; it does not make the evidence independently verified. The engine does not interpret conditions in prose.

### Provision segmentation

Statuses are `SEGMENTED`, `NOT_REQUIRED`, `REQUIRED`, and `UNKNOWN`. A whole instrument with staggered provisions must declare `REQUIRED` and fails current operational assessment. The engine never segments the material itself.

## Purposes

### `CURRENT_OPERATIONAL`

Requires an explicit `as_of` and succeeds only when every gate is true: current-ground eligibility; known and matching scope; known and matching artifact interval; identified instrument and provision; known and acceptable segmentation; known and matching applicability interval; and known, satisfied conditions. Missing values fail closed.

`authorizes_current_operational` is an explicit conjunction of those gates. It is never derived merely from an empty blocker list.

### `HISTORICAL_AS_OF`

Requires an explicit `as_of`, ratification, acceptable known authority, known matching scope, and a known matching artifact effective interval. `STALE`, `EXPIRED`, and `REVIEW_DUE` are reported but do not automatically block. Applicability, when supplied, is evaluated and reported separately so artifact history is not confused with the history of which provision governed a situation. Historical admission never authorizes current operational use.

### `COMPARATIVE_ANALYSIS`

Does not accept `as_of`. It requires a valid ratified record, acceptable known authority, known matching scope, and an identified instrument and provision. A missing artifact interval and current states `STALE`, `EXPIRED`, or `REVIEW_DUE` are tolerated. Comparative admission does not authorize current use, date-specific historical applicability, selection of a prevailing version, or comparison of content by the engine.

## Output discipline

The result preserves `current_operational_ground` separately from `purpose_assessment`. Blocking and unknown values are dimension-prefixed codes. The engine emits no localized conclusions and never labels a document true, legally valid, safe, or currently in force.

## Known separate finding

Artifact verification versus claim verification remains outside this phase. See `TEMPORAL_PURPOSE_FINDING.md` and `PROVISION_LEVEL_APPLICABILITY_FALSE_POSITIVE_01.md`.
