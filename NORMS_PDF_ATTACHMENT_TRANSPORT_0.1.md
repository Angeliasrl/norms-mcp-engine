# NORMS_PDF_ATTACHMENT_TRANSPORT_0.1

Status: **DESIGN_READY**, **LOCAL_RUNTIME_PASS** only after the test commands in this branch pass. Client status remains **CHATGPT_PROBE_PENDING** and **CLAUDE_PROBE_PENDING**.

## Capability matrix

`Documented` means the cited client documentation states the capability. It does not mean NORMS observed it in that client.

| Client | bytes to tool | file ID | temporary URL | MCP resource | resource_link | extracted text only | no reference | Classification |
|---|---|---|---|---|---|---|---|---|
| ChatGPT MCP connector | Not documented as automatic attachment handoff; real probe required | Documented in widget APIs (`uploadFile`, `selectFiles`) | Documented in widget API (`getFileDownloadUrl`) | MCP UI resources are documented, not automatic user-attachment resources | Tool file references are mentioned by the download helper; exact tool envelope needs probe | Possible model context, but not acceptable as original bytes | Possible if host does not bind attachment | CHATGPT_PROBE_PENDING |
| Claude web custom connector | No documented automatic handoff of chat attachment bytes to a tool | Not documented | Not documented | Remote connectors document text and binary resources supplied by the server | Not established for chat attachments | Claude documents its own PDF processing, not connector forwarding | Possible; real probe required | CLAUDE_PROBE_PENDING |
| Claude Code MCP | Local files can be read by Claude Code, but automatic bytes-as-tool-argument is not documented | Not documented | Not documented | Documented: list/read resources; referenced resources become attachments | Not established as a local-file handoff | Piped/local content is available to Claude Code, but is not original-byte transport to NORMS | Tool receives none unless an explicit tool/resource path is used | CLAUDE_PROBE_PENDING |

Sources checked 2026-08-06: [OpenAI component bridge](https://developers.openai.com/plugins/reference#windowopenai-component-bridge), [OpenAI MCP server guidance](https://developers.openai.com/apps-sdk/build/mcp-server), [Anthropic remote connector support](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers), [Claude Code MCP resources](https://docs.anthropic.com/en/docs/claude-code/mcp), and [Claude document uploads](https://support.anthropic.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude-ai).

The matrix deliberately does **not** infer that a PDF attached to the chat is forwarded to a connector tool. A native path may be promoted only after a client probe records the actual tool arguments/result envelope and verifies the SHA-256 against the local source file.

## Client-independent protocol

1. `create_pdf_upload_session` authenticates the owner/session and returns a random upload ID plus short-lived one-use signed `PUT` URL.
2. The browser/widget streams raw bytes to that URL. The MCP JSON never carries unbounded base64.
3. The upload service consumes the URL on first attempt, enforces the byte ceiling while streaming, calculates the original-byte SHA-256, checks `%PDF-`, and makes the parser traverse the document.
4. `finalize_pdf_upload` optionally compares the caller-known SHA-256 and returns only an opaque `norms-upload:<id>` internal reference.
5. `audit_uploaded_pdf` resolves that reference inside the pipeline. NORMS Core is not called until a page-aware document bundle with original-byte provenance exists.
6. `delete_pdf_upload` deletes bytes, discards the cached bundle, verifies absence, and is idempotent.

The filename is neither accepted nor retained as authority. Ownership and chat session are server-derived, never model assertions. There is no public list, permanent URL or arbitrary URL fetch by the container. Retention cleanup is short and deletion events contain metadata only.

## Tools and functions

- MCP: `createPdfUploadSession`, `finalizePdfUpload`, `auditUploadedPdf`, `deletePdfUpload`, exposed under the requested snake-case names by `registerPdfUploadTools`.
- Pipeline: `PdfUploadService` and the `UploadStorage` protocol; `TempUploadStorage` is the local/test adapter. A future R2 adapter must preserve opaque IDs and the same create/path-delete/exists semantics. No cloud resource exists in this checkpoint.
- UI fallback: `ui/pdf-upload.html`, “Carica il PDF in NORMS”, directly `PUT`s the selected file to the one-use URL. It does not use OpenAI APIs or generative keys.

## Threats and gates

| Threat | Gate |
|---|---|
| renamed executable/text | PDF magic plus parser |
| truncated/polyglot/parser bomb | parser traversal, byte cap, short timeout at deployment layer |
| replay/race | lock-protected one-use state transition before reading body |
| cross-user/session access | owner and session comparison on every post-upload operation |
| traversal/hostile name | random safe upload ID; no client filename in storage |
| tampering | streaming byte hash plus optional finalize hash comparison |
| SSRF | container receives only `norms-upload:<id>`, never caller URL |
| content leakage | content-free events; no bytes/text/token in tool results or logs |
| retention failure | expiry cleanup plus verified deletion |
| hash confusion | `byte_sha256` remains distinct from bundle/evidence/semantic hashes |

## Required client probes

For each client: attach a known PDF; call a diagnostic tool whose schema has explicit optional file/resource fields; capture the exact tool arguments and host metadata without content logging; test file ID download only inside an authorized widget; hash the downloaded bytes; compare with the local hash; delete the probe upload. Record absent fields as absent. Until then no PASS claim is permitted.

No merge, push, deploy, Cloudflare resource, secret, or modification to the queued preview workflow is part of this checkpoint.
