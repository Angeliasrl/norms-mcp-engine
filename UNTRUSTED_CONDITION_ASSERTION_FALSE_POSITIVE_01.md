# UNTRUSTED_CONDITION_ASSERTION_FALSE_POSITIVE_01

Status: binding finding  
Date: 3 August 2026

Audit v3 produced three operational false positives. In every case the record supplied `applicability_conditions.status: SATISFIED` even though the preregistered Oracle facts contradicted that assertion. The engine correctly followed the structured value, exposing a contract defect: structured data is not necessarily verified data, and a caller, extractor, or model can insert an unverified conclusion as if it were evidence.

Canonical principle:

> Applicability conditions must be evaluated from evidence, not asserted as satisfied by the caller.

The legacy APIs and their old record contract remain unchanged. The purpose-aware path must reject caller-supplied legacy `status` and must never treat it as verified evidence or migrate it automatically.
