# MCP production security and privacy facts 01

Status: pre-deployment facts; not a public privacy policy.

## Application facts

- The only MCP tool accepts structured normative records, structured facts, purpose, date, and explicit trusted-evaluation records.
- PDFs, URLs to retrieve, binaries, conversations, expected outcomes, and instructions to bypass gates are not accepted inputs.
- Processing is limited to deterministic in-memory assessment.
- The application has no database, durable storage binding, cache binding, analytics binding, authentication, user account, secret, or outbound network call.
- Application code does not log request or response payloads.
- Invalid inputs return stable sanitized errors without stack traces or local paths.
- Request bodies above 65,536 bytes are rejected.

## Proposed infrastructure facts

The proposed processor is Cloudflare through a native Worker serving the `beforebabel.org` zone. `wrangler.jsonc` enables Workers observability and invocation logs with a `0.01` head sampling rate. NORMS does not intentionally record inputs or outputs. If deployed with this configuration, Cloudflare may retain sampled technical infrastructure and invocation metadata according to the active plan; actual account-specific retention, regional handling, deletion controls, access permissions, and incident process have not yet been verified and must not be described as zero retention.

No application-level subprocessors beyond the selected hosting provider are configured. The intended canonical hostname is `norms.beforebabel.org`, but it is not active or verified in this preparatory state. No production region, account, plan, or log-retention period has been selected. These are manual-gate facts and must be recorded from the real Cloudflare configuration before a public privacy policy or OpenAI submission is prepared.

`RATE_LIMITING_STATUS: DEFERRED_PENDING_PRODUCTION_TRAFFIC_BASELINE`. No rigid per-IP limit is introduced before representative traffic exists; request-size, CPU, schema-validation, read-only, and no-egress controls remain active.

## Operational controls still required

- confirm least-privilege administrative access and account ownership;
- confirm infrastructure log fields and retention;
- decide rate limiting or equivalent abuse protection;
- document incident contact and deletion handling;
- verify the deployed Worker has no bindings or secrets;
- verify HTTPS, headers, errors, concurrency, payload limits, and rollback remotely.
