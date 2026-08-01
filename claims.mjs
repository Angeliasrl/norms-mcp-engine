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

/**
 * Evidence baseline. Commit 83438ef is the first public commit; it contains
 * the exact sources and tests these claims are about, and it is immutable in
 * a way `main` is not. Permalinks therefore pin that commit, not a branch.
 * The artifact_sha256 of each row is the SHA-256 of the primary referenced
 * file as stored at that commit (`git show <commit>:<path> | sha256sum`).
 */
const REPO = 'https://github.com/Angeliasrl/norms-mcp-engine';
const COMMIT = '83438ef4492df5be91550386307d520690371fb0';
const blob = (path) => `${REPO}/blob/${COMMIT}/${path}`;

const SHA = {
  model: '876d77cf67d211bfe17fa2f08c29587a5e6e9b58ae51d61f2dff1ccee9330f8d',
  canonical: '8b9b968518d6109a7ca9b6c34ddc3241ba0187f1312f51eadc56428b03998fb9',
  suite: '1bcbd7b7de8cdd7f6448dd1bc57111911170bbfc058f33372d684149b9ae51e8',
  buildClaimmap: '7d23023d49e1cded973314167fbbded0367bc416e5eddf4201d14d450ddbf8d1',
  workflow: 'cef584d116f3189d9a997a3b5376673af0e5f12bf9db1da4b800c87517aa0121',
};

const observed = (primaryPath, primarySha, scope) => ({
  evidence_ref: `${blob(primaryPath)} ; ${blob('test/suite.mjs')}`,
  repository: REPO,
  artifact_sha256: primarySha,
  observed_at: '2026-08-01',
  observer:
    'Francesco Riva (author). Suite plus a 63-probe adversarial pass on 2026-08-01. Not an independent verification.',
  scope,
  evidence_class: 'PUBLICLY_INSPECTABLE',
  revalidate_at: '2027-02-01',
});

export const claims = [
  // ---- the engine ----------------------------------------------------------
  {
    id: 'E1',
    section: 'engine',
    claim: 'Origin and verification are modelled as two independent axes, all four cells representable',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'src/model.js; tests "all four origin × verification cells are representable", "origin survives ratification". Prototype, tested; not integrated into any server.',
  },
  {
    id: 'E2',
    section: 'engine',
    claim: '`currency`, `authority_status` and `expiry_status` are multi-valued with UNKNOWN',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'src/model.js; tests "UNKNOWN fails closed…", "INVALID and UNKNOWN are not conflated".',
  },
  {
    id: 'E3',
    section: 'engine',
    claim: 'UNKNOWN fails closed without being recorded as a negative finding',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'The verdict separates `blocking` from `unknown`, plus an explicit `unexamined` flag.',
  },
  {
    id: 'E4',
    section: 'engine',
    claim: '`eligible_as_ground` is computed, never read from a stored field',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'eligibleAsGround(); no boolean is taken from the entry.',
  },
  {
    id: 'E5',
    section: 'engine',
    claim: '`admissible_for(context)` separates eligibility from applicability',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'admissibleFor(); an entry with no declared scope returns admissible:false, scope_known:false.',
  },
  {
    id: 'E6',
    section: 'engine',
    claim: 'RATIFIED without a complete ratification block is rejected',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'Throws RATIFIED_WITHOUT_PROOF, RATIFICATION_INCOMPLETE, RATIFICATION_BAD_DIGEST, RATIFICATION_BAD_DATE.',
  },
  {
    id: 'E7',
    section: 'engine',
    claim: 'Fingerprint divergence yields STALE; an absent document yields UNKNOWN',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'revalidate(); one test asserts the wording is revalidation and not falsification.',
  },
  {
    id: 'E8',
    section: 'engine',
    claim: 'PERMANENT requires recorded authority and reason, enforced in validateEntry',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'Moved into validateEntry after the seventh review found it bypassable by never calling evaluateExpiry.',
  },
  {
    id: 'E9',
    section: 'engine',
    claim: 'Corpus digest uses length-prefixed framing with UTF-8 byte counts',
    state: 'O',
    level: 3,
    ...observed('src/canonical.js', SHA.canonical, 'src/canonical.js and test/suite.mjs at commit 83438ef'),
    note: 'src/canonical.js; 8-byte unsigned big-endian prefix; byteLength via TextEncoder.',
  },
  {
    id: 'E10',
    section: 'engine',
    claim: 'Plain concatenation is ambiguous and framing removes the ambiguity',
    state: 'O',
    level: 3,
    ...observed('src/canonical.js', SHA.canonical, 'src/canonical.js and test/suite.mjs at commit 83438ef'),
    note: 'Test "COLLISION: plain concatenation is ambiguous" constructs two corpora that collide naively and verifies the framed digests differ. A demonstration, not an assertion.',
  },
  {
    id: 'E11',
    section: 'engine',
    claim: "This package's own claim map is linted by its own linter",
    state: 'O',
    level: 3,
    ...observed(
      'scripts/build-claimmap.mjs',
      SHA.buildClaimmap,
      'claims.mjs, scripts/build-claimmap.mjs and test/suite.mjs at commit 83438ef'
    ),
    note: 'claims.mjs is the canonical form; the suite runs lintClaimMap over it and fails if the committed CLAIM_MAP.md has drifted from the generated output. Narrowed after the seventh review found the earlier claim covered the linter only, never the map.',
  },
  {
    id: 'E12',
    section: 'engine',
    claim: 'The suite runs with no network, no account and no deployment',
    state: 'O',
    level: 3,
    ...observed(
      '.github/workflows/verify.yml',
      SHA.workflow,
      'CI run 30688819509 on commit 83438ef, Node 20/22/24, all green'
    ),
    evidence_ref: `${REPO}/actions/runs/30688819509 ; ${blob('.github/workflows/verify.yml')}`,
    note: 'node test/suite.mjs. Public CI executed the suite on the public repository with no install step, no secrets and no deployment; the run is publicly inspectable.',
  },
  {
    id: 'E13',
    section: 'engine',
    claim: 'Scope matching is exact-value only',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'Stated as a v0.1 limit. No hierarchy, wildcard or negation. An empty or malformed scope throws rather than matching.',
  },
  {
    id: 'E14',
    section: 'engine',
    claim: 'Every public API validates its input and fails with a stable error code',
    state: 'O',
    level: 3,
    ...observed('src/model.js', SHA.model, 'src/model.js and test/suite.mjs at commit 83438ef'),
    note: 'validateEntry, eligibleAsGround, admissibleFor, scopeMatches, revalidate, evaluateExpiry. Added after the seventh review found revalidate throwing a bare TypeError on a malformed record.',
  },
  {
    id: 'E15',
    section: 'engine',
    claim: 'Digest and index apply the same admission rules to documents',
    state: 'O',
    level: 3,
    ...observed('src/canonical.js', SHA.canonical, 'src/canonical.js and test/suite.mjs at commit 83438ef'),
    note: 'normaliseDocuments() is the single gate. Previously buildIndex accepted duplicate ids that canonicalBytes rejected, so index and digest could disagree about the corpus.',
  },
  {
    id: 'E16',
    section: 'engine',
    claim: 'Document ids that collide with Object prototype keys are handled safely',
    state: 'O',
    level: 3,
    ...observed('src/canonical.js', SHA.canonical, 'src/canonical.js, src/model.js and test/suite.mjs at commit 83438ef'),
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
    support_status: 'O',
    note: 'The fourth cell exists in the implementation and has no name in a three-state scheme. support_status describes the premise, not the thesis.',
  },
  {
    id: 'D2',
    section: 'derived',
    claim: 'Conflating UNKNOWN with a negative finding loses a distinction that matters',
    state: 'D',
    level: 2,
    derived_from: ['E2', 'E3'],
    support_status: 'O',
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
    support_status: 'O',
    note: 'Follows from the API surface: no function blocks, mutates or revokes.',
  },
];

/** Prose sections appended to the generated Markdown, kept here so the
 *  generated file has a single source. */
export const prose = {
  evidenceDebt:
    'As of 2026-08-01 every E row is O: the repository is public and each reference resolves to a ' +
    'permalink pinned to commit 83438ef, the first public commit, which contains the exact sources and ' +
    'tests the claims are about. E12 additionally cites a green public CI run on that commit. ' +
    'No new fact occurred at promotion; publication made the existing references resolvable. ' +
    'The observer is the author, so no row exceeds construction level 3 and none claims level 6 ' +
    '(independently verified). The remaining debt is independent replication or attestation, and it is ' +
    'still open. S and D rows are unchanged: nothing beyond the engine is claimed.',
  underClaiming:
    'The seventh review found the previous map marking as "specified, not built" a model that was already ' +
    'implemented and tested. The error was in the conservative direction. Every mechanism in this discipline ' +
    'pushes claims downward: O-PENDING lowers, the support rule lowers, evidence classes lower, UNKNOWN fails ' +
    'closed. Nothing in it detects work that was done and not recorded. Over-claiming produces a conflict ' +
    'someone notices; under-claiming produces nothing at all. Generating this map from data is a partial ' +
    'remedy; deriving states from the tests themselves is not implemented and is recorded here as an open ' +
    'problem, not a solved one.',
};
