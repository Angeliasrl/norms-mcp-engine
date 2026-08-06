# NORMS end-to-end MCP contract 0.2.0

Flow: public MCP Worker → private resolver binding → official acquisition and evidence package → explicit entry assertions → canonical NORMS input validation → unchanged deterministic Core.

`resolve_normative_evidence` accepts exactly one of `citation` or `official_url`, plus `jurisdiction`, optional `as_of`, bounded `source_requirements`, and `request_id`. Its output separates matching, temporal evidence, corroboration, blocking, unknown, unexamined, audit level, readiness, package SHA-256 and resolution fingerprint.

`audit_normative_reliance` adds explicit `context`, `reliance_purpose` and `entry_assertions`. `CURRENT_OPERATIONAL` and `HISTORICAL_AS_OF` require `as_of`; `COMPARATIVE_ANALYSIS` forbids it. `entry.scope` is not copied from context. Free text is never sent to Core.

Fail-closed gates before Core: resolver success; `PUBLIC_RESOLVED`; readiness true; empty contradiction ledger and blocking; lowercase SHA-256; canonical package hash equality; canonical public NORMS schema validation. Failure returns a null normative assessment and `NORMS_CORE_NOT_CALLED`.

Document SHA-256 binds acquired bytes; package SHA-256 binds canonical serialized package content; resolution fingerprint binds the semantic resolution projection. They are not interchangeable.

The preview configuration selects the isolated Worker `norms-mcp-e2e-preview`, Container application `norms-resolver-e2e-preview`, Cloudflare `basic`, one active instance, a dedicated Durable Object namespace, and workers.dev only. It declares no route or custom domain. Container HTTPS egress is intercepted and restricted to the versioned official-provider allowlist. The cross-repository GitHub workflow recreates the approved sibling checkout structure (`norms-document-pipeline` and `_pubblicazione/norms-mcp-engine`), so the versioned Dockerfile path is valid locally and in CI without copying source. Preview must be deployed separately, smoke-tested, and deleted after evidence capture. Production is never a preview rollback target.

PDF support covers only bounded official HTTPS URLs. MCP chat attachments and unbounded base64 are out of scope.
