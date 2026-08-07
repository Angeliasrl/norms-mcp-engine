# MCP server operations 01

Status: local development operation only. No production endpoint exists.

## Start and stop

Requirements: Node.js 20 or later and dependencies installed from the committed
lockfile.

```text
npm ci
npm run start:mcp
```

Defaults:

- bind address: `127.0.0.1`;
- port: `3000`;
- MCP: `POST /mcp`;
- health: `GET /healthz`.

Set `PORT` to an integer from 0 through 65535 to select another port. Set
`NORMS_MCP_HOST` only for local test needs; public binding is not a production
deployment procedure. Stop with SIGINT or SIGTERM. The listener closes cleanly;
each stateless request owns and closes its MCP transport and server instance.

## Operational boundaries

### Preview PDF attachments from ChatGPT

The isolated PDF preview advertises `audit_pdf_attachment` with the official
`_meta["openai/fileParams"]` file-input contract. ChatGPT supplies a temporary
HTTPS `download_url`; the Worker downloads the original bytes with a bounded
request, validates PDF type, size, magic bytes and SHA-256, then performs
create, upload, finalize, normative audit and verified delete internally.
The `file_id` alone is never treated as byte provenance. Upload, finalize,
audit and delete capabilities remain separate and are neither returned by this
tool nor placed in query strings, logs or artifacts.

- Stateless Streamable HTTP; no database or persistence.
- No authentication or OAuth.
- Outbound calls are limited to the preview's configured resolver Container and
  the bounded HTTPS file URL supplied through the ChatGPT file-input contract.
- No external telemetry.
- No request-payload logging and no payloads in errors.
- Request-size limit: 65,536 bytes.
- Request/response timeout: 5,000 ms.
- Stable sanitized protocol/engine errors without stack traces or paths.
- Localhost DNS-rebinding protection is supplied by the official SDK helper.
- `/healthz` returns only `{ "status": "ok" }`.

This is insufficient for production. Rate limiting, deployment monitoring,
incident response, privacy/retention policy, stable HTTPS hosting, domain
verification and rollback remain gates for a later authorized phase.

## Verification

`npm test` runs model and claim-map gates, transport initialization and discovery,
valid/invalid calls, schema and annotation assertions, determinism, minimal
concurrency, health check, and five positive plus three negative submission
cases through the actual MCP transport.

`npm audit` checks the locked dependency tree. Dedicated typecheck and lint
commands are not configured.
