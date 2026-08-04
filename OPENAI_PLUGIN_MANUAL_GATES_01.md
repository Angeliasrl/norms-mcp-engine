# OpenAI plugin manual gates 01

Prepared: 2026-08-04

None of these items is marked PASS until verified in the live OpenAI Platform interface.

| Gate | Required action | Status |
|---|---|---|
| Organization | Select the organization that will own the public plugin. | PENDING_PORTAL |
| Developer identity | Verify and select the individual identity `Francesco Riva`; confirm public URLs and contacts match. | PENDING_PORTAL |
| Permission | Confirm Apps Management: Write / `api.apps.write`; confirm read access for draft status. | PENDING_PORTAL |
| Logo | Upload an approved production asset. No approved logo exists in the repository. | MANUAL_GATE_LOGO |
| Category | Select the closest available developer-infrastructure or structured-assessment category from the actual portal taxonomy. | PENDING_PORTAL |
| Countries | Review the displayed country list and select all permitted, legally applicable countries; do not select unavailable territories. | PENDING_PORTAL |
| Domain challenge | Obtain the real token, configure it as a Cloudflare secret, verify exact-body HTTP 200, complete verification, then follow OpenAI guidance on retaining or removing the secret. Never commit the token. | PENDING_PORTAL |
| Scan Tools | Run Scan Tools against the Universal MCP URL. | PENDING_PORTAL |
| Scan result | Review the single discovered tool, metadata, schemas, domains and validation output; remediate before proceeding if divergent. | PENDING_PORTAL |
| Policy attestations | Read and truthfully complete every final attestation shown by the portal. | PENDING_PORTAL |

## Logo specification gate

The repository contains no clearly approved brand asset. Do not generate or substitute one automatically.

- Proposed filename: `norms-evidence-scope-logo.png`
- Format: production PNG unless the portal explicitly accepts another format.
- Dimensions: use the exact dimensions and file-size limit displayed by the current portal; no public numeric requirement was assumed in this package.
- Composition: square, simple, high-contrast, legible at small sizes, with an opaque or portal-compatible background.
- Exclusions: no OpenAI, Cloudflare or third-party marks.

## Challenge runbook

The current endpoint intentionally returns 404 because no token has been issued. After the portal supplies a token, store it only as the Worker secret already supported by the route. The response must be HTTP 200 with the exact token as the entire body, correct text content type, no JSON, markup or redirect. Record verification without recording the token.
