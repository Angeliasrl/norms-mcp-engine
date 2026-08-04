# MCP production deployment 01

Status: `PASS_PRODUCTION_MCP_ENDPOINT`

Verified at `2026-08-04T15:47:05Z`. The canonical endpoint is `https://norms.beforebabel.org/mcp`; health is `https://norms.beforebabel.org/healthz`.

## Provider decision

Cloudflare Workers native is the selected first option. The existing tool is exposed through Streamable HTTP by `createMcpHandler`; local Wrangler execution proves that the engine and tool do not require a container. Cloudflare Containers and Google Cloud Run are therefore not selected and have no demonstrated necessity.

The Worker is named `norms-mcp` and exposes `POST /mcp` and `GET /healthz`. It has no outbound application requests, database, persistence, secrets, authentication, or filesystem dependency. Requests are limited to 65,536 bytes, protocol processing has a sanitized 5,000 ms timeout, and Wrangler applies a 1,000 ms CPU limit. The Worker creates a fresh stateless MCP server for the handler path.

Workers Observability is enabled with a `0.01` head sampling rate. NORMS does not intentionally log inputs or outputs. Sampled infrastructure invocation metadata may be retained by Cloudflare according to the active account plan.

`RATE_LIMITING_STATUS: DEFERRED_PENDING_PRODUCTION_TRAFFIC_BASELINE`. A rigid per-IP limit is intentionally deferred because anonymous legitimate clients may share egress addresses. Request size, CPU limit, schema validation, read-only behavior, and absence of outbound calls remain active controls. A later rate policy must be based on observed production traffic.

## Reproducible local gate

```text
npm ci
npm test
npm run test:worker
npx wrangler deploy --dry-run --outdir .wrangler-dist
npm audit
```

`npm run test:worker` starts Wrangler locally and executes initialize, tools/list, metadata, valid and invalid calls, determinism, concurrency, health, request-size enforcement, five positive submission cases, three negative submission cases, and Node/Workers parity.

The MCP SDK v1 Node adapter emits Draft-07 JSON Schema and automatically adds `execution.taskSupport = forbidden`; the MCP server v2 used by `createMcpHandler` emits semantically equivalent JSON Schema 2020-12 and omits that optional wire field. Tool name, title, description, inputs, outputs, required fields, annotations, instructions, behavior, and structured results are otherwise identical. No engine semantic change is involved.

## Verified deployment

- Provider: Cloudflare Workers native, global edge placement; no fixed application region selected.
- Account: the single authenticated account containing the `beforebabel.org` zone; no email or full account identifier is recorded here.
- Plan: Workers Paid, confirmed by the account holder.
- Worker: `norms-mcp`.
- Temporary verification URL: `https://norms-mcp.friva1947.workers.dev`; fully tested, then disabled in production configuration.
- Temporary version: `c2128653-260a-4bdc-981a-050fb81722ff`, created `2026-08-04T15:44:30.371Z`.
- Canonical custom domain: `https://norms.beforebabel.org`.
- Canonical version: `49e16f0d-0627-4c9a-b61a-df4eb7650e83`, created `2026-08-04T15:46:34.032Z` and deployed `2026-08-04T15:46:36.695Z`.
- Upload size: 998.65 KiB; gzip 195.47 KiB; startup time reported by deploy: 84 ms.
- Uploaded digest: not provided by Wrangler. Reproducible dry-run `index.js` SHA-256: `621D18AF0499F5F77F6AE97D3CBD4B000131AD896AF3A15539707459B42870D8`.
- Runtime configuration: compatibility date `2026-08-04`, `nodejs_compat`, CPU limit 1,000 ms, request limit 65,536 bytes, protocol timeout 5,000 ms.
- Data bindings and secrets: none; `wrangler secret list` returned an empty list.
- Observability: enabled, invocation logs persisted with head sampling `0.01`.
- Infrastructure log retention: 7 days for Workers Paid according to Cloudflare's published Workers Logs table; the active plan was confirmed by the account holder.

## Verification results

The local baseline passed 162 repository tests. The local Workers runtime additionally passed 9 transport tests, 8 submission cases (5 positive and 3 fail-closed/rejected), and 3 Node/Workers parity checks.

The temporary workers.dev endpoint passed the same 9 transport tests, 8 submission cases, and 3 parity checks after initial edge propagation completed. The canonical domain then passed the complete set again, plus HTTPS, certificate negotiation, health body, no redirect, non-permissive CORS, sanitized invalid call, 65,536-byte enforcement, deterministic repetition, minimal concurrency, method rejection, and unknown-path rejection. Essential metadata and structured outputs matched the local baseline. The standard `server: cloudflare` infrastructure header is present; no application framework, local path, stack trace, secret, or internal identifier is exposed.

`npm audit` reports zero vulnerabilities. The lockfile applies a narrow `undici` 7.29.0 override to Wrangler/Miniflare because the otherwise selected nested 7.28.0 release is covered by published advisories. The local Workers gate is rerun against the overridden dependency.

## Rollback

The previous deployed version is `c2128653-260a-4bdc-981a-050fb81722ff`; it contains the same verified application code and differs in deployment routing state. If rollback is required, first inspect `npx wrangler deployments list`, then use `npx wrangler rollback <VERSION_ID>`. Verify `GET https://norms.beforebabel.org/healthz` immediately afterward. Redeploy the repository commit recorded by this phase to restore the canonical verified version. No engine modification is required.
