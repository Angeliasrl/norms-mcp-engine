# NORMS_PDF_ATTACHMENT_TRANSPORT_0.1

Status: **DESIGN_READY**, pending local suite completion. Client status remains **CHATGPT_PROBE_PENDING** and **CLAUDE_PROBE_PENDING**.

## Boundary and capabilities

The MCP endpoint is authless. Caller `owner_id` and `session_id` values are not verified identity and are not authorization. Each upload has four independent, 256-bit random bearer capabilities:

| Capability | Scope | Consumption |
|---|---|---|
| upload | one object PUT only | one-use |
| finalize | inspected upload only | one-use |
| audit | finalized object only | one-use |
| delete | exact upload and capability revocation | repeatable for idempotent cleanup |

Only scoped HMAC-SHA-256 digests are persisted. Comparisons are constant-time, capabilities expire, can be revoked, never enter logs, and are forbidden in query parameters. The upload capability is placed in a fragment and moved to the `Authorization` header in memory.

## State machine

`CREATED -> UPLOADING -> UPLOADED -> FINALIZED -> AUDITING -> CONSUMED -> DELETED`, with `EXPIRED`, `REJECTED`, and `FAILED` alternatives. The Durable Object is the serialization atom for one upload. Exact predecessor checks reject replay, double finalize/audit, concurrent delete/audit and corrupted persisted state.

## Private Cloudflare contract (not provisioned)

- `PdfUploadDurableObject` stores state, capability digests, TTL, R2 version/ETag/length and verified byte SHA-256.
- `createPrivateR2UploadAdapter` streams to a private R2 binding under a random 256-bit object key unrelated to the filename.
- No bucket URL, public bucket, caller-selected key or arbitrary URL is exposed.
- The resolver/container may receive bytes only through the Worker/internal binding after R2 metadata and byte provenance verification.
- Explicit delete plus a short R2 lifecycle rule are required before deployment. The DO alarm is an expiry signal; deployment wiring must delete the exact R2 key and retain lifecycle as a safety net.
- `TempUploadStorage` is test-only. No R2 bucket, DO namespace, Worker, lifecycle rule or secret is created here.

## Upload UI

The static page uses `Referrer-Policy: no-referrer`, a deny-by-default CSP, same-origin connections, no inline/external third-party script, analytics, cookie or local storage. It removes the fragment, validates same origin, streams with XHR progress, supports cancellation and explicit deletion, and reports expiry, size, conflict and active-content rejection without filenames in logs.

## PDF safety boundary

The Python inspector rejects JavaScript, `OpenAction`, additional actions, launch actions, embedded files, unsupported encryption, parser repair/inconsistency, excessive pages, objects and page blocks. Byte and decompression/complexity ceilings remain mandatory. This is not a claim of general malware scanning.

## Preview-only native client probe

`diagnose_native_file_envelope` is registered only when both `ENVIRONMENT=preview` and `PDF_ATTACHMENT_PROBE_ENABLED=true`. It returns only presence booleans, media type and declared size; it never returns or retains content. Outcomes are:

- `NATIVE_FILE_HANDOFF_PASS`
- `NATIVE_FILE_REFERENCE_PASS`
- `MODEL_TEXT_ONLY`
- `NO_FILE_TRANSPORT`
- `CLIENT_CAPABILITY_UNKNOWN`

Extracted model text is never treated as original bytes. Promotion requires an observed client envelope and byte-hash verification. Production must not enable the diagnostic tool.

## Remaining proof

ChatGPT and Claude native attachment behavior is unverified. Cloud lifecycle configuration, internal container byte handoff and resource cleanup require a later isolated preview. No push, deploy or cloud resource creation is part of this checkpoint.
