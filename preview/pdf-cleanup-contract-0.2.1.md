# Preview PDF cleanup evidence 0.2.1

The preview Worker reports deletion separately from an independent, object-scoped
R2 metadata lookup. `verified_absent` is `true`, `false`, or `null`; it is never
inferred from a successful delete call.

The evidence records the claim, its single-session/single-object scope, UTC check
time, `R2_HEAD_AFTER_DELETE` method, storage liveness and outcome, a bounded proof,
and blockers. It never exposes the bucket key, capability, authorization data, or
an upload URL. Its explicit limit is that it does not prove absence from backups,
logs, or external systems.

For `audit_pdf_attachment`, the Worker wraps the pipeline document bundle as
`0.2.1`, binds the PDF SHA-256, canonical audit-request SHA-256, and NORMS output
SHA-256, then attaches cleanup evidence after deletion. An empty `audit_request`
continues to report `NORMS_CORE_NOT_CALLED`. The separate live Core smoke supplies
only the fixed canonical synthetic CURRENT_OPERATIONAL fixture; it does not infer
normative input from PDF text.
