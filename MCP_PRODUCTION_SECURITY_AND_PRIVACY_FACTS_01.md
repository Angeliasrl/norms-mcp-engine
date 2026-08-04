# MCP production security and privacy facts 01

Status: verified production facts; not a public privacy policy.

## Application facts

- The only MCP tool accepts structured normative records, structured facts, purpose, date, and explicit trusted-evaluation records.
- PDFs, URLs to retrieve, binaries, conversations, expected outcomes, and instructions to bypass gates are not accepted inputs.
- Processing is limited to deterministic in-memory assessment.
- The application has no database, durable storage binding, cache binding, analytics binding, authentication, user account, secret, or outbound network call.
- Application code does not log request or response payloads.
- Invalid inputs return stable sanitized errors without stack traces or local paths.
- Request bodies above 65,536 bytes are rejected.

## Infrastructure facts

The processor is Cloudflare through the native `norms-mcp` Worker serving `norms.beforebabel.org`. `wrangler.jsonc` enables Workers observability and invocation logs with a `0.01` head sampling rate. NORMS does not intentionally record inputs or outputs. Cloudflare may retain sampled technical infrastructure and invocation metadata. The account holder confirmed Workers Paid; Cloudflare's published retention for Workers Logs on that plan is 7 days. This is not zero logging or zero retention.

No application-level subprocessors beyond Cloudflare are configured. The canonical hostname `norms.beforebabel.org` and its Cloudflare-managed HTTPS certificate were verified. The Worker runs on Cloudflare's global network; no fixed application region is configured. The deployment has no data bindings or secrets, and the application has no persistence or outbound network operation.

`RATE_LIMITING_STATUS: DEFERRED_PENDING_PRODUCTION_TRAFFIC_BASELINE`. No rigid per-IP limit is introduced before representative traffic exists; request-size, CPU, schema-validation, read-only, and no-egress controls remain active.

## Operational controls

- OAuth administrative access remains outside the repository; account ownership was confirmed through the single authenticated Wrangler account.
- Cloudflare retains sampled infrastructure logs for the plan's documented 7-day period; application payload logging is absent from source.
- `RATE_LIMITING_STATUS: DEFERRED_PENDING_PRODUCTION_TRAFFIC_BASELINE`; review metrics before choosing a shared-IP-safe policy.
- HTTPS, errors, concurrency, payload limits, absence of bindings/secrets, and rollback metadata were verified remotely.
- Public incident contact and deletion-request handling remain matters for the later public policy phase.
