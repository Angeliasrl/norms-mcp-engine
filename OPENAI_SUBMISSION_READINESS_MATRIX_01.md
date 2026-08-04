# OPENAI MCP submission readiness matrix 01

Assessment date: 2026-08-04 (Europe/Rome)

Repository: `norms-mcp-engine`

Branch: `architecture/condition-evidence-boundary-01`

Baseline commit: `c9292eece108d52efaf8976e0a89c19ccb468a8e`

Verdict: **BLOCKED**

## Scope and evidence boundary

This assessment covers the repository at the baseline commit and publicly
checkable repository/release state. It does not access the OpenAI submission
portal and does not infer deployment, publisher, privacy, or operational facts
that are absent from the repository.

Permitted public description:

> A deterministic applicability and evidence-boundary engine for structured
> normative records and structured facts.

It evaluates explicitly structured authority, scope, temporal applicability,
verification, and conditions. It reports `blocking`, `unknown`, and
`unexamined`, fails closed when required bases are missing, and does not infer
normative conditions from free text. It does not provide legal advice, certify
overall compliance, autonomously interpret arbitrary legal documents, or accept
contract PDFs as directly ratified input.

## Official requirements consulted

Consulted 2026-08-04:

- OpenAI, [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- OpenAI, [Submit plugins](https://developers.openai.com/plugins/deploy/submission)
- OpenAI, [MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- OpenAI, [Plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
- OpenAI, [Security & Privacy](https://developers.openai.com/plugins/guides/security-privacy)
- OpenAI, [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- OpenAI, [Optimize metadata](https://developers.openai.com/plugins/guides/optimize-metadata)
- OpenAI, [Plugin submission errors](https://developers.openai.com/plugins/deploy/submission-errors)

The applicable requirements include a public production MCP endpoint; accurate
tool names, descriptions, schemas and annotations; five positive and three
negative review tests; verified publisher identity and write permission; and
public website, support, privacy, and terms URLs matching the publisher.

## Repository and release state

| Item | Status | Evidence |
|---|---|---|
| Branch and baseline | READY | Branch and commit match the phase request. |
| Working tree at preflight | READY | Clean before these four readiness documents were created. |
| Remote | READY | `origin` is the public GitHub repository. Local and remote branch hashes matched at preflight. |
| Package | READY, engine only | `package.json` is version 0.1.0 and explicitly says pure functions, no I/O, no transport, not an MCP server. |
| GitHub release 0.1.0 | READY, experimental engine prerelease only | Public, non-draft prerelease published 2026-08-01; tag resolves to `7089673865a3c6e04db3b73e1c7df0e79e4b8718`. |
| npm publication | GAP | Registry lookup returned 404; no npm package is published. This is not itself an MCP submission blocker. |
| Current CI | GAP | Existing workflow runs the original model suite and claim-map check, not all later procurement tests and no MCP integration test. |

## Complete READY / GAP / BLOCKER matrix

| Area | Requirement | Status | Finding / remediation |
|---|---|---:|---|
| Product | Narrow, accurate public scope | READY | Scope above matches implemented engine behavior. |
| Product | Customer-facing name | GAP | Draft `NORMS Structured Applicability`; confirm trademark/name availability and publisher match. |
| Product | Actual MCP tools | BLOCKER | No MCP server or tools exist in this branch. Build and freeze the minimal tool surface. |
| Product | No redundant/internal tools | BLOCKER | Cannot assess until a tool list exists. |
| Endpoint | Public stable production URL | **BLOCKER** | **PRODUCTION_MCP_ENDPOINT_MISSING**. No URL is configured or evidenced. |
| Endpoint | Streamable HTTP initialization | BLOCKER | No MCP transport/initialization implementation exists. |
| Endpoint | HTTPS, availability, latency | BLOCKER | No endpoint to probe. |
| Endpoint | Errors, timeouts, input-size limits | BLOCKER | Engine has stable model error codes, but no server error contract or operational limits. |
| Endpoint | Rate limiting | BLOCKER | Not implemented/evidenced. |
| Endpoint | Logging/metrics/alerts | BLOCKER | No server exists; data fields, redaction, retention, and alerts are undefined. |
| Endpoint | Rollback | BLOCKER | No deployment or rollback procedure exists. |
| Endpoint | No localhost/tunnel dependency | READY for repo, BLOCKER operationally | No endpoint is claimed; a compliant stable endpoint still must be deployed without a temporary tunnel. |
| Tools | Name/title/description | BLOCKER | No tool metadata. |
| Tools | Input/output schemas and required fields | BLOCKER | Engine validates JavaScript objects but publishes no MCP JSON schemas. |
| Tools | Error contract and examples | BLOCKER | Engine errors exist; MCP mapping and examples do not. |
| Tools | Server instructions and `_meta` | BLOCKER | Absent. |
| Tools | Security scheme | BLOCKER | No authentication decision or advertised scheme. |
| Tools | `readOnlyHint` | BLOCKER | No tool exists to annotate. Proposed assessment tool should be `true` only if server handling has no state-changing effects, including job starts or writes. |
| Tools | `openWorldHint` | BLOCKER | Must be declared from deployed behavior; likely `false` for a pure computation, not yet demonstrable. |
| Tools | `destructiveHint` | BLOCKER | Must be declared from deployed behavior; likely `false`, not yet demonstrable. |
| Tools | Minimal input | GAP | Engine API is structured and does not require conversation history; final MCP schema still needs data-minimization review. |
| Tools | Minimal output | BLOCKER | No MCP response exists to inspect for debug data, identifiers, local paths, or secrets. |
| Privacy | Data categories/purpose | BLOCKER | Server inputs are not frozen. Define them from the minimum structured assessment schema. |
| Privacy | Storage/retention/deletion | BLOCKER | Engine is non-persistent, but server behavior and policy are undefined. |
| Privacy | Personal/sensitive data policy | BLOCKER | No server policy or schema-level exclusion exists. |
| Privacy | Subprocessors/transfers | BLOCKER | Hosting and observability stack are unknown. |
| Security | Secrets/environment | GAP | No committed secrets found; production secret inventory and rotation are unavailable. |
| Security | Prompt injection/untrusted input | GAP | Closed structured predicates and validation help; server-level payload validation and abuse tests are absent. |
| Security | Dependency review | READY for engine | Runtime dependencies are empty. `npm audit` cannot run without a lockfile; server dependencies remain unknown. |
| Security | Incident response | BLOCKER | Owner, contact, procedure, and notification route are not documented. |
| Public URLs | Website | BLOCKER | No verified publisher website URL recorded. |
| Public URLs | Privacy policy | BLOCKER | No published, behavior-matched policy URL. |
| Public URLs | Terms | BLOCKER | No published terms URL. |
| Public URLs | Support | BLOCKER | No published support URL/contact confirmed for the plugin. |
| Publisher | Verified identity | BLOCKER / MANUAL | Not checked; portal access was forbidden. |
| Publisher | Correct organization | BLOCKER / MANUAL | Not checked. |
| Publisher | Apps Management: Write | BLOCKER / MANUAL | Not checked. Official docs also identify `api.apps.write`. |
| Publisher | Global data residency project | BLOCKER / MANUAL | Not checked; current review requirements say EU-residency projects cannot submit MCP plugins. |
| Domain | Challenge hosting | BLOCKER / MANUAL | No MCP domain; ability to serve `/.well-known/openai-apps-challenge` is unverified. |
| Listing | Logo/category/name availability | GAP / MANUAL | No submission-ready logo; category and availability must be selected from current portal choices. |
| Tests | Five positive + three negative defined | READY as design | Defined in `OPENAI_SUBMISSION_TEST_CASES_01.md`. |
| Tests | Tests execute submitted MCP server | BLOCKER | No MCP server, so all eight remain `NOT_EXECUTABLE`. |
| Verification | Engine suite | READY | Run in this phase; result recorded below/final report. |
| Verification | MCP Inspector/init/list/calls | BLOCKER | Cannot run without an MCP entrypoint. No dependency was installed. |

## Exact remediation order

1. Freeze one minimal, read-only MCP assessment tool and its JSON input/output
   contracts; do not expose corpus-management or claim-map internals unless a
   separate user goal requires them.
2. Implement a Streamable HTTP MCP adapter around the canonical engine API,
   including bounded payloads, timeouts, stable sanitized errors, and no
   inference from free text.
3. Add exact tool metadata and annotations, then run initialization, list-tools,
   one valid call and one invalid call through the actual MCP transport.
4. Define the production data flow: collection, logs, retention, deletion,
   subprocessors, transfers, incident response, secrets, monitoring, rate limit,
   and rollback.
5. Publish behavior-matched website, privacy, terms, and support pages under the
   intended verified publisher identity.
6. Deploy a stable HTTPS universal endpoint (normally `/mcp`) on a controlled
   public domain; add monitoring and a tested rollback. Do not use a temporary
   tunnel.
7. Execute the eight review cases against that endpoint, run MCP Inspector, and
   record latency, sanitization, determinism, annotations, and schema results.
8. Manually verify publisher identity, organization, Apps Management Write,
   global data residency, domain challenge capability, logo, category, and
   initial countries.
9. Re-run the complete readiness gate. Only then prepare the package or access
   the submission portal under a separately authorized phase.

## Phase status

- Submission: **NOT PERFORMED**
- Portal access: **NOT PERFORMED**
- Production change: **NOT PERFORMED**
- Commit/push: **NOT PERFORMED**
- Next phase: `OPENAI_MCP_SUBMISSION_REMEDIATION_01`
