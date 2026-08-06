# NORMS MCP trusted external evaluation boundary 0.1.1

## Decision

The deterministic Core is unchanged. The public MCP adapter no longer treats
`trusted_external_evaluations` supplied in the same request as a trust anchor.

The public field remains schema-valid temporarily for compatibility. Every
non-empty value is classified `CALLER_SUPPLIED_UNTRUSTED`. The adapter calls
`resolveServerTrustedExternalEvaluations`, and only the registry returned by
that component may be passed to the Core.

Version 0.1.1 configures no trusted external authority. Its internal registry is
always empty, `accepted_count` is always zero, and no public value can produce
the Core basis `EXTERNALLY_RATIFIED`.

## Stable findings

- `trusted_external_evaluations.CALLER_SUPPLIED_UNTRUSTED`
- `trusted_external_evaluations.NO_SERVER_TRUST_POLICY_CONFIGURED`

When an external evaluation is required, these findings are added to
`purpose_assessment.unknown`. Authorization and admissibility remain false;
`unexamined` remains derived from the final blocker/unknown state.

Every successful MCP response also exposes `trust_boundary`, including the
classification, counts and reason codes. Thus the deprecated public field is
never ignored silently, including when the record has no external condition.
When the field is absent and no external evaluation is relevant, classification
is `NOT_SUPPLIED` and reason codes are empty; the boundary adds no unknown.

## Compatibility and limits

The input shape is retained, but its former trust semantics are intentionally
removed. The fixed, zero-input positive demo remains a server-owned synthetic
demonstration and is not an authority registry or a route for user facts.

A future trust policy must be explicit, server-controlled, independently
configured and tested. It must not accept private keys in the repository or
derive trust from caller-controlled identity strings or digest claims.

## Explicit limit

0.1.1 prevents self-ratification but does not yet implement a verified external
trust policy. External evaluations remain unconfirmed until that infrastructure
is available.

> 0.1.1 impedisce l’auto-ratifica ma non implementa ancora una trust policy
> esterna verificata. Le valutazioni esterne rimangono unconfirmed finché tale
> infrastruttura non sarà disponibile.
