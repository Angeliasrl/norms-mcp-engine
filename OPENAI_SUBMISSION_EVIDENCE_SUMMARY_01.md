# OpenAI submission evidence summary 01

Prepared: 2026-08-04

Status: **READINESS EVIDENCE ONLY — NOT A SUBMISSION**

Verdict: **BLOCKED**

## Problem and bounded product claim

NORMS is a deterministic applicability and evidence-boundary engine for
structured normative records and structured facts. It is designed to expose why
a selected normative unit may or may not be used for a narrowly specified
purpose, without turning missing information into permission.

The current repository contains an experimental JavaScript engine, not an MCP
server. It has no I/O, network, persistence, transport, entrypoint, tool handler,
or deployment. Accordingly, this summary does not claim that ChatGPT or Codex
can call NORMS today.

## Architecture demonstrated by the engine

The public `assessRelianceForPurpose` path validates a structured entry,
selected provision, purpose, evaluation date, scope context and condition
evidence. Current-operational authorization requires explicit acceptable gates
for the normative unit, segmentation, provision interval, applicability
conditions, authority, verification/current-ground eligibility, and scope.

Conditions are evaluated through a bounded typed predicate DSL or a fully
ratified external evaluation. Caller-asserted status and free text cannot supply
the result. The output distinguishes findings in `blocking`, unverified elements
in `unknown`, and whether the assessment remains `unexamined`.

The repository also contains canonicalization and claim-map linting functions.
These are library APIs, not MCP tools. The submission surface should remain
focused on the recognizable user goal of assessing structured applicability;
internal corpus/claim-map utilities should not be exposed without a separate,
justified user workflow.

## Evidence available

- The negative procurement matrix covers non-segmentation, missing provision or
  interval, dates outside the interval, unverified conditions/facts, free-text
  only information, unknown authority/scope, unconfirmed records, missing or
  false eligibility, and incomplete blocker lists. All remain fail-closed.
- The positive synthetic procurement matrix supplies every required structured
  gate and demonstrates one current-operational positive result plus adjacent
  fail-closed controls and repeated-output determinism.
- The Italian public procurement Audit 02 demonstrates only a limited real
  predicate: structured contract type and net amount against the historically
  verified Article 50(1)(b) threshold. It does not establish overall procedural
  legality.
- Audit 01 remains source-incomplete. The later US ICS Nett exploration is
  source-incomplete and is neither reopened nor required for this submission.
- The claim map records evidence level and explicitly says that the engine has
  not been independently verified and that an MCP server does not exist.

## Claims allowed and excluded

Allowed: NORMS deterministically evaluates explicitly structured authority,
scope, temporal applicability, verification and conditions; reports blocking,
unknown and unexamined; fails closed on missing bases; and does not derive
normative conditions from free text.

Excluded: legal compliance certification, legal advice, complete legal review,
fraud detection, arbitrary-document interpretation, “upload any contract and
receive a legal verdict”, or directly ratified PDF input.

## Proposed MCP surface and metadata boundary

No MCP tool is currently exposed. A remediation phase may propose one focused,
read-only assessment tool that maps to the canonical engine API. Until its
handler and operational behavior exist, its name, schema, authentication,
`_meta`, instructions, and annotations are not facts.

If implementation remains a computation with no state changes or external
actions, the candidate annotations would be `readOnlyHint: true`,
`openWorldHint: false`, and `destructiveHint: false`. They must be verified
against the deployed handler, including logging/job side effects, before being
advertised. OpenAI treats tool metadata as a user-facing, versioned contract.

## Privacy and security

The engine itself has no network, persistence, runtime dependencies, or logging.
Those properties do not prove anything about a future MCP server. Hosting,
inputs, logs, personal-data handling, retention, deletion, subprocessors,
transfers, incident response, secrets, size limits, timeouts, rate limiting,
monitoring and rollback are all unresolved.

The intended server should accept only the minimum structured record, facts,
scope and evaluation context required for the assessment; it must not request a
conversation transcript. Outputs should contain only the assessment fields
needed by the user and no stack trace, local path, secret, telemetry, request ID
or undisclosed internal identifier. Inputs remain untrusted and require
server-side validation and bounded execution.

OpenAI’s current guidance requires a published privacy policy describing data
categories, purposes, recipients, retention and user controls, plus public
website, support and terms URLs matching the verified publisher. None is
verified for this plugin.

## Submission tests

Five positive and three negative reviewer test designs are recorded separately.
They cover a complete synthetic record, atomic structured condition, temporal
membership, the limited Italian public fixture, determinism, unknown authority,
missing provision and free-text-only information. They are deliberately marked
`NOT_EXECUTABLE`: review tests must traverse the submitted MCP server, and no
such server exists.

## Readiness conclusion

The engine evidence supports preparing a narrowly described product, but public
MCP submission is blocked by the absence of the server and production endpoint,
tool schemas/metadata/annotations, operational security and privacy controls,
public policy/support/site URLs, and manually verified publisher/domain gates.
The exact endpoint blocker is `PRODUCTION_MCP_ENDPOINT_MISSING`.

Next phase: `OPENAI_MCP_SUBMISSION_REMEDIATION_01`.
