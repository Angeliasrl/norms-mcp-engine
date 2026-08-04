# MCP production deployment 01

Status: `READY_FOR_MANUAL_CLOUDFLARE_LOGIN`

No login, Worker creation, deploy, custom domain, or DNS operation has been performed.

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

## Manual gate

An authorized operator must authenticate, select the Cloudflare account containing `beforebabel.org`, verify that Workers Paid supports the configured CPU limit, and confirm observability retention. The intended temporary hostname is the account's `norms-mcp.<subdomain>.workers.dev`; the intended canonical endpoints are `https://norms.beforebabel.org/mcp` and `https://norms.beforebabel.org/healthz`.

```text
npx wrangler login
npx wrangler whoami
npx wrangler deploy
```

Deployment sends the bundled Worker source and runtime dependencies to Cloudflare. It does not require the repository evidence dossiers at runtime. The public URL, region placement, deployment/version ID, uploaded bundle hash, infrastructure log retention, rate-limit policy, and rollback target remain `NOT_ESTABLISHED` until a real deployment is authorized and verified.

`npm audit` reports zero vulnerabilities. The lockfile applies a narrow `undici` 7.29.0 override to Wrangler/Miniflare because the otherwise selected nested 7.28.0 release is covered by published advisories. The local Workers gate is rerun against the overridden dependency.

## Post-gate verification

After an authorized deploy, record the actual HTTPS `/mcp` and `/healthz` URLs and run the full remote checklist, including all eight submission cases and exact essential-output comparison with the local baseline. Use Cloudflare version history for rollback only after a verified prior version exists.
