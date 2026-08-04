# OpenAI plugin submission package 01

Prepared: 2026-08-04

Verdict: READY_FOR_OPENAI_PLUGIN_PORTAL

This package prepares a draft; it does not create or submit one in the OpenAI Platform.

## Submission identity

- Type: With MCP, MCP-only
- Public name: NORMS: Evidence & Scope
- Publisher: Francesco Riva
- Conceptual category: developer infrastructure / structured assessment
- MCP URL type: Universal
- MCP endpoint: https://norms.beforebabel.org/mcp
- Authentication: none
- UI: none
- UI CSP: not applicable
- Tool count: one
- Tool: `assess_normative_reliance`
- Worker: `norms-mcp`
- Verified deployment version at package start: `61cd9543-5eed-4273-a1f0-3981b8acc410`

## Public definition

NORMS assesses whether structured, ratified normative records have sufficient verified grounds to be relied upon for a declared purpose. It reports blockers, unknowns and unexamined areas and fails closed when required grounds are missing or unverified.

It does not retrieve laws, interpret free normative text, analyze PDFs, approve contracts, provide legal advice, certify conformity, independently verify supplied facts or modify external systems.

## Package inventory

- `OPENAI_PLUGIN_LISTING_FINAL_01.md`: primary listing plus two prudent alternatives.
- `OPENAI_PLUGIN_STARTER_PROMPTS_01.md`: five structured-record prompts.
- `OPENAI_PLUGIN_REVIEW_TESTS_01.md`: exactly five positive and three negative cases with copyable fixtures.
- `OPENAI_PLUGIN_RELEASE_NOTES_01.md`: initial-submission release note.
- `OPENAI_PLUGIN_MANUAL_GATES_01.md`: portal-only gates, logo specification and challenge runbook.
- `OPENAI_PLUGIN_ADVERSARIAL_EVIDENCE_SUMMARY_01.md`: optional public reviewer note.
- `OPENAI_PLUGIN_PORTAL_FIELD_MAP_01.md`: field-to-artifact map and frozen official requirements.

## Verified public surfaces

- Website: https://norms.beforebabel.org/
- Input contract: https://norms.beforebabel.org/input-contract
- Support: https://norms.beforebabel.org/support
- Privacy: https://norms.beforebabel.org/privacy
- Terms: https://norms.beforebabel.org/terms
- Health: https://norms.beforebabel.org/healthz
- Repository: https://github.com/Angeliasrl/norms-mcp-engine

The challenge route remains intentionally inactive until the portal issues a real token.

## Fixed capability boundary

The MCP server exposes only `assess_normative_reliance`. Its current typed schema is the single canonical public contract. The package does not duplicate that schema, add tools, change annotations, alter fail-closed behavior or modify the Worker.

## Reviewer evidence

- Five positive and three negative transport-level cases are executable through the production-shaped MCP server.
- Synthetic fixtures are explicitly artificial.
- The minimized Italian case is limited to a structured supply/type and threshold predicate, not overall legality.
- Determinism is tested by deep equality of repeated results.
- Unknown authority, missing provision and facts confined to display text fail closed.

## Manual gates remaining

The draft phase must verify the organization, individual Developer Identity, Apps Management Write/`api.apps.write`, production logo, available category, country list, domain challenge, Scan Tools result and final attestations. These are intentionally PENDING, not represented as PASS.

## Availability

Proposed selection: every country the portal actually allows and in which publication is lawful. The live portal list must be reviewed before selection.

## Final boundary

This commit may be pushed as documentation. Do not activate the challenge, open or submit a portal draft, create a release, modify main, or change the production server in this phase.
