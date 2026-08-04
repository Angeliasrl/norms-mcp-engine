# OpenAI plugin portal field map 01

Prepared: 2026-08-04

## Frozen official sources

Consulted on 2026-08-04:

- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/app-review
- https://developers.openai.com/plugins/app-guidelines
- https://developers.openai.com/plugins/guides/security-privacy
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/deploy/submission-errors

The official submission guide permits an MCP-only plugin under `With MCP`, requires listing materials, starter prompts, five positive and three negative tests, availability and release notes, and requires Apps Management: Write plus a verified publisher identity. A fixed endpoint uses MCP URL type `Universal`. Domain verification uses an exact token at `/.well-known/openai-apps-challenge`, followed by Scan Tools. Portal-only values remain manual gates.

## Field map

| Portal area | Value or source | Status |
|---|---|---|
| Submission type | With MCP; MCP-only | PREPARED |
| Plugin name | NORMS: Evidence & Scope | PREPARED |
| Publisher | Francesco Riva | PREPARED; IDENTITY PENDING |
| Short/long description | `OPENAI_PLUGIN_LISTING_FINAL_01.md` | PREPARED |
| Logo | No approved asset; see manual gate | MANUAL_GATE_LOGO |
| Category | Choose only from live taxonomy; target developer infrastructure / structured assessment | PENDING_PORTAL |
| Website | https://norms.beforebabel.org/ | VERIFIED_PUBLIC |
| Support | https://norms.beforebabel.org/support | VERIFIED_PUBLIC |
| Privacy | https://norms.beforebabel.org/privacy | VERIFIED_PUBLIC |
| Terms | https://norms.beforebabel.org/terms | VERIFIED_PUBLIC |
| Repository | https://github.com/Angeliasrl/norms-mcp-engine | PREPARED |
| MCP URL type | Universal | PREPARED |
| MCP URL | https://norms.beforebabel.org/mcp | VERIFIED_PUBLIC |
| Authentication | None | VERIFIED_SERVER |
| UI | None | VERIFIED_SERVER |
| UI CSP | Not applicable | PREPARED |
| Tool annotations | readOnly=true, openWorld=false, destructive=false | VERIFIED_SERVER |
| Starter prompts | `OPENAI_PLUGIN_STARTER_PROMPTS_01.md` | PREPARED |
| Reviewer tests | `OPENAI_PLUGIN_REVIEW_TESTS_01.md`; exactly 5 positive + 3 negative | PREPARED |
| Availability | All countries actually permitted by portal and applicable law | PENDING_PORTAL |
| Release notes | `OPENAI_PLUGIN_RELEASE_NOTES_01.md` | PREPARED |
| Domain challenge | Route ready; token absent; 404 expected | PENDING_PORTAL |
| Scan Tools | Not run | PENDING_PORTAL |
| Policy attestations | Not completed | PENDING_PORTAL |

## Transport note for reviewers

Normal OpenAI MCP clients negotiate Streamable HTTP automatically. A manual client may send `Accept: application/json, text/event-stream`. This is an integration detail, not listing copy.
