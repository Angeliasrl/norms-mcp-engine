# AUDIT_QUESTION_AND_EXPECTED_REFERENCE_01

## Audit questions separated by decision level

### A. Qualification predicate

> Given separately verified and structured values for the applicant's qualification, categories and classes, and the categories and amounts in the complete lex specialis, do those values satisfy the ratified normative contract?

### B. Platform predicate

> Given official evidence of the platform configuration at the material time, did the platform filter prevent the qualification path that satisfied predicate A?

### C. External comparison

> Is the NORMS outcome coherent with, or divergent from, the separately held ANAC dispositive?

Predicates A and B test pre-ratified structured inputs. Predicate C is a post-run comparison and cannot influence either input or engine evaluation. None asks NORMS to interpret free legal text, infer a class or amount, decide proportionality, or derive a condition from the ANAC dispositive. The definitive input schema cannot be built until the missing primary records are acquired.

## Reference and comparison state

- `expected_reference_outcome`: `ANAC_FOUND_CONTRACTING_AUTHORITY_CONDUCT_NONCOMPLIANT`
- `reference_scope`: ANAC's official dispositive concerning the contracting authority's conduct; it is not a finding that the applicant was necessarily entitled to admission on a fully verified individual qualification record.
- `engine_outcome`: `NOT_RUN`
- `comparison_status`: `PENDING`
- `structured_fixture_status`: `NOT_READY`

The dispositive (`DS-001`) and ANAC evaluations (`EV-*`) are quarantined reference outputs. They must not be copied into input facts, condition evidence, or expected predicates exposed to the engine.

## Required future structured inputs

| Input | Current state | Permitted source |
|---|---|---|
| Applicant OG11 certificate, class, capacity, validity, verification | UNKNOWN | Official tender file or verifiable official qualification evidence |
| Complete categories and amounts in the lex specialis | PARTIAL / UNKNOWN | Official invitation, specification, or RDO record |
| Exact platform filter configuration at the material time | UNKNOWN; applicant and authority assertions are not enough | Official MEPA/RDO export or institutional tender record |
| Definitive publication/start and lex-specialis dates | UNKNOWN | Official tender record |
| Ratified mapping from selected normative segments to the binary predicate | NOT CREATED | Separate human ratification phase, with interpretation kept explicit |
| Scope and authority verification for each input | NOT CREATED | Structured fixture phase after source completion |

## Contamination controls

- No ANAC outcome is an input fact.
- No massima is a normative unit.
- Party assertions are labelled and cannot satisfy a fact gate.
- No unit was selected from a secondary summary.
- No 2026 text replaces the requested historical view.
- Missing values remain `UNKNOWN`; nothing is inferred from narrative text.
- ANAC's interpretive route is recorded as evaluation and remains outside deterministic input.

## Readiness decision

- `verdict`: `SOURCE_INCOMPLETE`

The official opinion, publication page, historical candidate units, and a corroborating ASL act are frozen. Execution remains blocked by the absent primary tender documents, exact operator qualification, category amounts, platform filter evidence, and definitive material dates. NORMS has not been executed and no positive or negative fixture has been created.
