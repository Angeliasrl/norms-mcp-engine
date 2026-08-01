/**
 * The claim map of this package, as data.
 *
 * This file is the canonical form. `CLAIM_MAP.md` is generated from it by
 * `scripts/build-claimmap.mjs`, and the suite fails if the committed Markdown
 * has drifted from what this file produces.
 *
 * The reason for the inversion: a claim map kept as prose is a convention
 * someone has to remember to apply, and the project's own history shows that
 * convention failing three times in a row — rows marked O with unresolved
 * references, and a header declaring the wrong version. Data is lintable.
 */

export const meta = {
  package: 'norms-mcp-engine',
  version: '0.1.0',
  scope:
    'This map covers the engine: src/model.js, src/canonical.js, src/claimmap.js and test/suite.mjs. ' +
    'It does not cover an MCP server, a deployment, or any corpus. Claims about those appear only as A.',
};

/** Sections in presentation order. */
export const sections = [
  { id: 'engine', title: 'The engine' },
  { id: 'beyond', title: 'Beyond the engine' },
  { id: 'derived', title: 'Derived claims' },
];

export const claims = [
  // ---- the engine ----------------------------------------------------------
  {
    id: 'E1',
    section: 'engine',
    claim: 'Origin and verification are modelled as two independent axes, all four cells representable',
    state: 'O-PENDING',
    level: 3,
    note: 'src/model.js; tests "all four origin × verification cells are representable", "origin survives ratification". Prototype, tested, not integrated into any server and not publicly inspectable.',
  },
  {
    id: 'E2',
    section: 'engine',
    claim: '`currency`, `authority_status` and `expiry_status` are multi-valued with UNKNOWN',
    state: 'O-PENDING',
    level: 3,
    note: 'src/model.js; tests "UNKNOWN fails closed…", "INVALID and UNKNOWN are not conflated".',
  },
  {
    id: 'E3',
    section: 'engine',
    claim: 'UNKNOWN fails closed without being recorded as a negative finding',
    state: 'O-PENDING',
    level: 3,
    note: 'The verdict separates `blocking` from `unknown`, plus an explicit `unexamined` flag.',
  },
  {
    id: 'E4',
    section: 'engine',
    claim: '`eligible_as_ground` is computed, never read from a stored field',
    state: 'O-PENDING',
    level: 3,
    note: 'eligibleAsGround(); no boolean is taken from the entry.',
  },
  {
    id: 'E5',
    section: 'engine',
    claim: '`admissible_for(context)` separates eligibility from applicability',
    state: 'O-PENDING',
    level: 3,
    note: 'admissibleFor(); an entry with no declared scope returns admissible:false, scope_known:false.',
  },
  {
    id: 'E6',
    section: 'engine',
    claim: 'RATIFIED without a complete ratification block is rejected',
    state: 'O-PENDING',
    level: 3,
    note: 'Throws RATIFIED_WITHOUT_PROOF, RATIFICATION_INCOMPLETE, RATIFICATION_BAD_DIGEST, RATIFICATION_BAD_DATE.',
  },
  {
    id: 'E7',
    section: 'engine',
    claim: 'Fingerprint divergence yields STALE; an absent document yields UNKNOWN',
    state: 'O-PENDING',
    level: 3,
    note: 'revalidate(); one test asserts the wording is revalidation and not falsification.',
  },
  {
    id: 'E8',
    section: 'engine',
    claim: 'PERMANENT requires recorded authority and reason, enforced in validateEntry',
    state: 'O-PENDING',
    level: 3,
    note: 'Moved into validateEntry after the seventh review found it bypassable by never calling evaluateExpiry.',
  },
  {
    id: 'E9',
    section: 'engine',
    claim: 'Corpus digest uses length-prefixed framing with UTF-8 byte counts',
    state: 'O-PENDING',
    level: 3,
    note: 'src/canonical.js; 8-byte unsigned big-endian prefix; byteLength via TextEncoder.',
  },
  {
    id: 'E10',
    section: 'engine',
    claim: 'Plain concatenation is ambiguous and framing removes the ambiguity',
    state: 'O-PENDING',
    level: 3,
    note: 'Test "COLLISION: plain concatenation is ambiguous" constructs two corpora that collide naively and verifies the framed digests differ. A demonstration, not an assertion.',
  },
  {
    id: 'E11',
    section: 'engine',
    claim: "This package's own claim map is linted by its own linter",
    state: 'O-PENDING',
    level: 3,
    note: 'claims.mjs is the canonical form; the suite runs lintClaimMap over it and fails if the committed CLAIM_MAP.md has drifted from the generated output. Narrowed after the seventh review found the earlier claim covered the linter only, never the map.',
  },
  {
    id: 'E12',
    section: 'engine',
    claim: 'The suite runs with no network, no account and no deployment',
    state: 'O-PENDING',
    level: 3,
    note: 'node test/suite.mjs. Becomes O and PUBLICLY_INSPECTABLE once CI runs it on a public repository.',
  },
  {
    id: 'E13',
    section: 'engine',
    claim: 'Scope matching is exact-value only',
    state: 'O-PENDING',
    level: 3,
    note: 'Stated as a v0.1 limit. No hierarchy, wildcard or negation. An empty or malformed scope throws rather than matching.',
  },
  {
    id: 'E14',
    section: 'engine',
    claim: 'Every public API validates its input and fails with a stable error code',
    state: 'O-PENDING',
    level: 3,
    note: 'validateEntry, eligibleAsGround, admissibleFor, scopeMatches, revalidate, evaluateExpiry. Added after the seventh review found revalidate throwing a bare TypeError on a malformed record.',
  },
  {
    id: 'E15',
    section: 'engine',
    claim: 'Digest and index apply the same admission rules to documents',
    state: 'O-PENDING',
    level: 3,
    note: 'normaliseDocuments() is the single gate. Previously buildIndex accepted duplicate ids that canonicalBytes rejected, so index and digest could disagree about the corpus.',
  },
  {
    id: 'E16',
    section: 'engine',
    claim: 'Document ids that collide with Object prototype keys are handled safely',
    state: 'O-PENDING',
    level: 3,
    note: 'buildIndex uses a null-prototype object; revalidate looks up with Object.hasOwn or Map.get.',
  },

  // ---- beyond the engine ---------------------------------------------------
  {
    id: 'S1',
    section: 'beyond',
    claim: 'An MCP server consuming this engine exists',
    state: 'A',
    level: null,
    precondition: 'An entrypoint with read-only tool handlers. Not in this package.',
    note: 'Not claimed.',
  },
  {
    id: 'S2',
    section: 'beyond',
    claim: 'The transport is vendor-neutral',
    state: 'D',
    level: 2,
    derived_from: [],
    support_status: 'SPEC',
    note: 'A property of MCP, not of this engine. Nothing observed.',
  },
  {
    id: 'S3',
    section: 'beyond',
    claim: 'The layer constrains an executing agent',
    state: 'A',
    level: null,
    precondition:
      'A published, resolvable record of at least one such episode, plus a comparison run with the layer absent.',
    note: 'Not claimed. One anecdote exists in a private repository; it is not published and is not evidence here.',
  },
  {
    id: 'S4',
    section: 'beyond',
    claim: "The layer holds beyond the owner's availability",
    state: 'A',
    level: null,
    precondition:
      'A declared interval, marked before it begins, in which the owner is unreachable by construction and an executor is governed only by the layer.',
    note: 'Custodianship. Untouched.',
  },
  {
    id: 'S5',
    section: 'beyond',
    claim: 'A client fetched the corpus — verifiable server-side',
    state: 'A',
    level: 2,
    precondition: 'Per-consumer tokens and a read record, in a server that does not exist here.',
    note: 'Outside this package.',
  },
  {
    id: 'S6',
    section: 'beyond',
    claim: "An agent's output was shaped by the norms",
    state: 'A',
    level: null,
    precondition:
      'None available. Heeding is a property of reasoning, not of transport; no external mechanism can establish it.',
    note: 'A permanent limit of the design, recorded as such and not as a task.',
  },

  // ---- derived -------------------------------------------------------------
  {
    id: 'D1',
    section: 'derived',
    claim: 'A single-axis provenance scheme cannot name a declared-then-ratified constant',
    state: 'D',
    level: 2,
    derived_from: ['E1'],
    support_status: 'O-PENDING',
    note: 'The fourth cell exists in the implementation and has no name in a three-state scheme.',
  },
  {
    id: 'D2',
    section: 'derived',
    claim: 'Conflating UNKNOWN with a negative finding loses a distinction that matters',
    state: 'D',
    level: 2,
    derived_from: ['E2', 'E3'],
    support_status: 'O-PENDING',
    note: 'Argument. That the code separates them shows it was implemented, not that the thesis is true.',
  },
  {
    id: 'D3',
    section: 'derived',
    claim: 'Not every exclusion should decay; permanence must be a recorded decision',
    state: 'D',
    level: 1,
    derived_from: [],
    support_status: 'SPEC',
    note: 'A design argument. Reclassified after the seventh review: deriving it from E8 would infer a normative thesis from the fact that the code implements it.',
  },
  {
    id: 'D4',
    section: 'derived',
    claim: 'A claim map written as prose will drift, because nothing executes it',
    state: 'D',
    level: 2,
    derived_from: [],
    support_status: 'SPEC',
    note: 'A design argument, and the reason this map is data. The project has three instances of the failure in its own revision history; none is published, so none is cited here as evidence.',
  },
  {
    id: 'D5',
    section: 'derived',
    claim: 'Admissibility is not enforcement: the engine computes and reports, it prevents nothing',
    state: 'D',
    level: 2,
    derived_from: ['E4', 'E5'],
    support_status: 'O-PENDING',
    note: 'Follows from the API surface: no function blocks, mutates or revokes.',
  },
];

/** Prose sections appended to the generated Markdown, kept here so the
 *  generated file has a single source. */
export const prose = {
  evidenceDebt:
    'No row in this map is O. Every observation is O-PENDING for one reason: the repository is not public, ' +
    'so no reader can resolve any of these references today. Publication converts them without any new fact ' +
    'occurring. Closing the debt requires publication, a redacted extract with digests, or an independent ' +
    'attestation.',
  underClaiming:
    'The seventh review found the previous map marking as "specified, not built" a model that was already ' +
    'implemented and tested. The error was in the conservative direction. Every mechanism in this discipline ' +
    'pushes claims downward: O-PENDING lowers, the support rule lowers, evidence classes lower, UNKNOWN fails ' +
    'closed. Nothing in it detects work that was done and not recorded. Over-claiming produces a conflict ' +
    'someone notices; under-claiming produces nothing at all. Generating this map from data is a partial ' +
    'remedy; deriving states from the tests themselves is not implemented and is recorded here as an open ' +
    'problem, not a solved one.',
};
