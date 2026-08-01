# CLAIM MAP — norms-mcp-engine 0.1.0

> **Generated from `claims.mjs`. Do not edit by hand.**
> `node scripts/build-claimmap.mjs` regenerates it; the test suite fails if this
> file has drifted from the data.

## Scope of this map

This map covers the engine: src/model.js, src/canonical.js, src/claimmap.js and test/suite.mjs. It does not cover an MCP server, a deployment, or any corpus. Claims about those appear only as A.

## The axes

| State | |
|---|---|
| **O** | Observed, with a reference a third party can resolve now. |
| **O-PENDING** | Reported observation. The fact happened; the reference is not resolvable. **Not admissible as evidence.** |
| **D** | Derived from stated premises, whose state is declared. |
| **A** | Open. Blocked on a fact that has not occurred. Precondition named. |

**Construction level**: 1 conceptual · 2 documented/specified · 3 prototype · 4 limited operation · 5 full operation · 6 independently verified.

**Support rule.** A derived claim cannot carry stronger evidentiary support than its weakest factual premise. Enforced by R4 of the linter in this package.

---

## The engine

| # | Claim | State | Lvl | Support / evidence |
|---|---|---|---|---|
| E1 | Origin and verification are modelled as two independent axes, all four cells representable | **O-PENDING** | 3 | src/model.js; tests "all four origin × verification cells are representable", "origin survives ratification". Prototype, tested, not integrated into any server and not publicly inspectable. |
| E2 | `currency`, `authority_status` and `expiry_status` are multi-valued with UNKNOWN | **O-PENDING** | 3 | src/model.js; tests "UNKNOWN fails closed…", "INVALID and UNKNOWN are not conflated". |
| E3 | UNKNOWN fails closed without being recorded as a negative finding | **O-PENDING** | 3 | The verdict separates `blocking` from `unknown`, plus an explicit `unexamined` flag. |
| E4 | `eligible_as_ground` is computed, never read from a stored field | **O-PENDING** | 3 | eligibleAsGround(); no boolean is taken from the entry. |
| E5 | `admissible_for(context)` separates eligibility from applicability | **O-PENDING** | 3 | admissibleFor(); an entry with no declared scope returns admissible:false, scope_known:false. |
| E6 | RATIFIED without a complete ratification block is rejected | **O-PENDING** | 3 | Throws RATIFIED_WITHOUT_PROOF, RATIFICATION_INCOMPLETE, RATIFICATION_BAD_DIGEST, RATIFICATION_BAD_DATE. |
| E7 | Fingerprint divergence yields STALE; an absent document yields UNKNOWN | **O-PENDING** | 3 | revalidate(); one test asserts the wording is revalidation and not falsification. |
| E8 | PERMANENT requires recorded authority and reason, enforced in validateEntry | **O-PENDING** | 3 | Moved into validateEntry after the seventh review found it bypassable by never calling evaluateExpiry. |
| E9 | Corpus digest uses length-prefixed framing with UTF-8 byte counts | **O-PENDING** | 3 | src/canonical.js; 8-byte unsigned big-endian prefix; byteLength via TextEncoder. |
| E10 | Plain concatenation is ambiguous and framing removes the ambiguity | **O-PENDING** | 3 | Test "COLLISION: plain concatenation is ambiguous" constructs two corpora that collide naively and verifies the framed digests differ. A demonstration, not an assertion. |
| E11 | This package's own claim map is linted by its own linter | **O-PENDING** | 3 | claims.mjs is the canonical form; the suite runs lintClaimMap over it and fails if the committed CLAIM_MAP.md has drifted from the generated output. Narrowed after the seventh review found the earlier claim covered the linter only, never the map. |
| E12 | The suite runs with no network, no account and no deployment | **O-PENDING** | 3 | node test/suite.mjs. Becomes O and PUBLICLY_INSPECTABLE once CI runs it on a public repository. |
| E13 | Scope matching is exact-value only | **O-PENDING** | 3 | Stated as a v0.1 limit. No hierarchy, wildcard or negation. An empty or malformed scope throws rather than matching. |
| E14 | Every public API validates its input and fails with a stable error code | **O-PENDING** | 3 | validateEntry, eligibleAsGround, admissibleFor, scopeMatches, revalidate, evaluateExpiry. Added after the seventh review found revalidate throwing a bare TypeError on a malformed record. |
| E15 | Digest and index apply the same admission rules to documents | **O-PENDING** | 3 | normaliseDocuments() is the single gate. Previously buildIndex accepted duplicate ids that canonicalBytes rejected, so index and digest could disagree about the corpus. |
| E16 | Document ids that collide with Object prototype keys are handled safely | **O-PENDING** | 3 | buildIndex uses a null-prototype object; revalidate looks up with Object.hasOwn or Map.get. |

---

## Beyond the engine

| # | Claim | State | Lvl | Support / evidence |
|---|---|---|---|---|
| S1 | An MCP server consuming this engine exists | **A** | — | **Precondition:** An entrypoint with read-only tool handlers. Not in this package. Not claimed. |
| S2 | The transport is vendor-neutral | **D** | 2 | `derived_from: []` · `support_status: SPEC` A property of MCP, not of this engine. Nothing observed. |
| S3 | The layer constrains an executing agent | **A** | — | **Precondition:** A published, resolvable record of at least one such episode, plus a comparison run with the layer absent. Not claimed. One anecdote exists in a private repository; it is not published and is not evidence here. |
| S4 | The layer holds beyond the owner's availability | **A** | — | **Precondition:** A declared interval, marked before it begins, in which the owner is unreachable by construction and an executor is governed only by the layer. Custodianship. Untouched. |
| S5 | A client fetched the corpus — verifiable server-side | **A** | 2 | **Precondition:** Per-consumer tokens and a read record, in a server that does not exist here. Outside this package. |
| S6 | An agent's output was shaped by the norms | **A** | — | **Precondition:** None available. Heeding is a property of reasoning, not of transport; no external mechanism can establish it. A permanent limit of the design, recorded as such and not as a task. |

---

## Derived claims

| # | Claim | State | Lvl | Support / evidence |
|---|---|---|---|---|
| D1 | A single-axis provenance scheme cannot name a declared-then-ratified constant | **D** | 2 | `derived_from: [E1]` · `support_status: O-PENDING` The fourth cell exists in the implementation and has no name in a three-state scheme. |
| D2 | Conflating UNKNOWN with a negative finding loses a distinction that matters | **D** | 2 | `derived_from: [E2, E3]` · `support_status: O-PENDING` Argument. That the code separates them shows it was implemented, not that the thesis is true. |
| D3 | Not every exclusion should decay; permanence must be a recorded decision | **D** | 1 | `derived_from: []` · `support_status: SPEC` A design argument. Reclassified after the seventh review: deriving it from E8 would infer a normative thesis from the fact that the code implements it. |
| D4 | A claim map written as prose will drift, because nothing executes it | **D** | 2 | `derived_from: []` · `support_status: SPEC` A design argument, and the reason this map is data. The project has three instances of the failure in its own revision history; none is published, so none is cited here as evidence. |
| D5 | Admissibility is not enforcement: the engine computes and reports, it prevents nothing | **D** | 2 | `derived_from: [E4, E5]` · `support_status: O-PENDING` Follows from the API surface: no function blocks, mutates or revokes. |

---

## Evidence debt

No row in this map is O. Every observation is O-PENDING for one reason: the repository is not public, so no reader can resolve any of these references today. Publication converts them without any new fact occurring. Closing the debt requires publication, a redacted extract with digests, or an independent attestation.

## Note on under-claiming

The seventh review found the previous map marking as "specified, not built" a model that was already implemented and tested. The error was in the conservative direction. Every mechanism in this discipline pushes claims downward: O-PENDING lowers, the support rule lowers, evidence classes lower, UNKNOWN fails closed. Nothing in it detects work that was done and not recorded. Over-claiming produces a conflict someone notices; under-claiming produces nothing at all. Generating this map from data is a partial remedy; deriving states from the tests themselves is not implemented and is recorded here as an open problem, not a solved one.

## Counts

A: 5 · D: 6 · O-PENDING: 16
