# NORMS — Structured Normative Assessment

Publisher: Francesco Riva
Effective date: 4 August 2026

NORMS evaluates whether structured normative records and structured facts may be relied upon for a declared purpose. It reports blockers, unknowns and unexamined areas and fails closed when required grounds are missing or unverified.

The single read-only tool, `assess_normative_reliance`, evaluates explicitly supplied authority, scope, temporal applicability, verification and structured conditions. Typical uses include checking a fully structured record, evaluating a declared date against an explicit interval, and identifying missing evidence.

Results include admissibility and eligibility fields together with explicit `blocking`, `unknown` and `unexamined` values. An empty blocker list alone is never treated as authorization.

NORMS accepts only structured records and facts. It does not accept files or PDFs, retrieve laws from the Internet, infer normative conditions from free text, provide legal advice, certify overall compliance, or modify external data or systems.

Public links: `/privacy`, `/terms`, `/support`.

The public website links to `/input-contract` and the public repository. The live MCP `inputSchema` returned by `tools/list` is the sole canonical contract; the page explains how to discover it and renders automatically validated synthetic fixtures without restating the schema.

NORMS assesses records already structured and ratified. It does not create those records.

`blocking: []` is not authorization when `unknown` or `unexamined` remain.
