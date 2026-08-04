# OpenAI plugin listing draft 01

Status: **DRAFT — NOT SUBMISSION READY**

Prepared: 2026-08-04

Publisher identity, URLs, category, logo, availability, and tool surface remain
unverified.

## Listing proposal

**Plugin name:** NORMS Structured Applicability

The qualifier is intentional: `NORMS` alone is generic and could imply a broad
legal service. Final name availability and publisher alignment require manual
portal checks.

**Short description:** Evaluate structured normative records and structured
facts with deterministic, fail-closed applicability checks.

**Long description:** NORMS evaluates explicitly structured authority, scope,
verification, temporal applicability, and applicability conditions. It returns
structured eligibility results together with blocking, unknown, and unexamined
elements, and fails closed when a required fact or normative basis is absent or
unverified. NORMS does not infer normative conditions from free text, provide
legal advice, certify overall compliance, interpret arbitrary legal documents,
or treat uploaded PDFs as ratified normative input.

**Category:** `TBD_FROM_CURRENT_PORTAL_TAXONOMY` (likely a productivity or
developer-oriented category; do not assert a category until the portal list is
checked).

**Publisher:** `TBD_VERIFIED_IDENTITY`

**Website:** `TBD_PUBLIC_URL`

**Support:** `TBD_PUBLIC_URL`

**Privacy policy:** `TBD_PUBLIC_URL`

**Terms:** `TBD_PUBLIC_URL`

**Logo:** `TBD_PRODUCTION_ASSET`

**Initial countries:** `TBD_AFTER_SUPPORT_AND_TERMS_REVIEW`

## Five starter prompts

1. “Evaluate whether this fully structured normative record is applicable to
   these structured facts as of the supplied date, and list every blocker or
   unknown.”
2. “Check this ratified provision and verified fact set for current operational
   applicability without using the free-text notes as evidence.”
3. “Compare the evaluation date with the provision’s explicit applicability
   interval and explain the structured outcome fields.”
4. “Show why this assessment fails closed when authority is unknown, even if no
   explicit blocker has been found.”
5. “Run the same structured assessment twice and confirm whether the outputs are
   structurally identical.”

## Public limits

- Structured normative records and structured facts are required.
- Missing, unknown, unsupported, or unverified required elements fail closed.
- Free text is not a source of normative conditions or atomic facts.
- Exact-value scope matching is limited to the dimensions supported by the
  engine; it is not an ontology or general legal interpretation layer.
- The result concerns the selected predicate and units only, not overall legal
  compliance.
- NORMS is not legal advice and does not replace qualified review.
- Arbitrary contracts and laws are not interpreted automatically.
- PDF documents are not accepted as directly ratified normative inputs.
- No claim of independent verification is made.

## Excluded claims

Do not use “legal compliance certified”, “automatic legal advice”, “upload any
contract and receive a legal verdict”, “fraud detection”, “complete legal
review”, or “autonomous interpretation of arbitrary legal documents”.
