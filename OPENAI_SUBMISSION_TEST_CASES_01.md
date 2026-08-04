# OpenAI MCP submission test cases 01

Prepared: 2026-08-04

Execution status: **NOT_EXECUTABLE — no MCP server or tool is exposed**

These are reviewer-ready test designs, not successful server runs. The expected
tool is recorded as `TBD_ASSESS_STRUCTURED_APPLICABILITY_TOOL` until the actual
minimal MCP surface is implemented and frozen. It must map to the canonical
`assessRelianceForPurpose` path; the placeholder is not a second API.

All fixtures must be small public JSON payloads with synthetic identifiers and
dates, except the minimized Italian limited-predicate case. They must contain no
expected reference outcome, legal conclusion, repository path, private source,
or full conversation.

## Positive tests

| ID | Reviewer prompt | Expected tool/input | Essential output | PASS / FAIL | Time/setup |
|---|---|---|---|---|---|
| P1 complete | Evaluate this complete synthetic structured record for current operational applicability. | TBD tool; segmented provision, ratified unit, valid authority, matching scope, complete interval, satisfied structured condition and verified fact. | authorization true; `blocking: []`; `unknown: []`; `unexamined: false`; applicability and scope match. | PASS only if actual MCP response matches schema and all gates are explicit. FAIL on inference, missing field, or extra legal claim. | <5 s target; public synthetic fixture. |
| P2 atomic condition | Does this verified synthetic amount fact satisfy the explicit numeric predicate? | Same base fixture; `NUM_LT` condition and typed verified numeric fact. | condition satisfied and current authorization true. | PASS only when the predicate result is engine-derived. FAIL if free text contributes. | <5 s; synthetic. |
| P3 temporal inside | Evaluate on a date strictly inside the synthetic provision interval. | Same base fixture; only evaluation date exercises interval membership. | applicability match true; authorization true. | FAIL if boundary logic is not exact or output is non-schema. | <5 s; synthetic. |
| P4 Italian limited predicate | For the public minimized direct-award fixture, evaluate only supply type and amount-below-threshold predicate at the verified historical date. | Public minimized Audit 02 facts and ratified Art. 50(1)(b) unit; exclude the authority’s conclusion/dispositive language. | Positive only for the modeled type-and-threshold predicate; no overall-legality statement. | PASS if result is limited and fixture contains no expected outcome. FAIL on broader legal conclusion. | <5 s; published source hashes/setup documented. |
| P5 determinism | Run this exact synthetic assessment twice and compare the complete structured responses. | Identical P1 input twice. | Deep structural equality. | PASS only if byte-equivalent canonical JSON or documented structural equality holds after excluding no fields (no timestamps/request IDs should be returned). | <10 s; synthetic. |

## Negative tests

| ID | Reviewer prompt | Expected tool/input | Essential output | PASS / FAIL | Time/setup |
|---|---|---|---|---|---|
| N1 authority unknown | Evaluate this otherwise complete record whose authority is UNKNOWN. | P1 with only authority changed to UNKNOWN. | authorization false; authority listed in `unknown`; `unexamined: true`; no invented blocker required. | FAIL if empty `blocking` is treated as authorization. | <5 s; synthetic. |
| N2 provision absent | Evaluate this instrument without a selected provision. | P1 with selected provision removed. | authorization false and provision selection reported missing/unknown under canonical output. | FAIL on fallback to whole-instrument or free text. | <5 s; synthetic. |
| N3 free text only | Evaluate this case where the needed condition/fact appears only in `value` or notes. | P1 with structured fact removed and equivalent sentence only in free text. | authorization false; missing/unknown structured fact; no inference. | FAIL if text changes condition outcome or authorizes. | <5 s; synthetic. |

## Transport checks required for every tool

Once the server exists, perform MCP initialization and tool discovery, then one
schema-valid and one schema-invalid call per exposed tool. Validate HTTP/MCP
error mapping, absence of stack traces, paths, secrets and internal identifiers,
payload limits, timeout, retry determinism, and exact annotations. These checks
cannot be substituted by direct imports from `src/model.js`.
