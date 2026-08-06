# NORMS end-to-end MCP contract 0.2.0

Flow: public MCP Worker → private resolver binding → official acquisition and evidence package → explicit entry assertions → canonical NORMS input validation → unchanged deterministic Core.

`resolve_normative_evidence` accepts exactly one of `citation` or `official_url`, plus `jurisdiction`, optional `as_of`, bounded `source_requirements`, and `request_id`. Its output separates matching, temporal evidence, corroboration, blocking, unknown, unexamined, audit level, readiness, package SHA-256 and resolution fingerprint.

`audit_normative_reliance` adds explicit `context`, `reliance_purpose` and `entry_assertions`. `CURRENT_OPERATIONAL` and `HISTORICAL_AS_OF` require `as_of`; `COMPARATIVE_ANALYSIS` forbids it. `entry.scope` is not copied from context. Free text is never sent to Core.

Fail-closed gates before Core: resolver success; `PUBLIC_RESOLVED`; readiness true; empty contradiction ledger and blocking; lowercase SHA-256; canonical package hash equality; canonical public NORMS schema validation. Failure returns a null normative assessment and `NORMS_CORE_NOT_CALLED`.

Document SHA-256 binds acquired bytes; package SHA-256 binds canonical serialized package content; resolution fingerprint binds the semantic resolution projection. They are not interchangeable.

The preview configuration selects Cloudflare `basic`, maximum two instances and a private Durable Object/container binding. It is a deployment template, not an active configuration. Preview must be deployed separately, smoke-tested, and promoted gradually. Rollback targets the preceding Worker deployment and its approved image digest. No Cloudflare action is performed by repository CI.

PDF support covers only bounded official HTTPS URLs. MCP chat attachments and unbounded base64 are out of scope.
