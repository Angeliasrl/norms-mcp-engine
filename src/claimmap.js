/**
 * norms-mcp — claim map linter.
 *
 * The reviewer's finding: "This rule should be enforced by a test over the claim
 * map itself, so a row cannot be marked O without the required fields. Until
 * that test exists this section is maintained by hand and will drift — which is
 * precisely the failure mode the document is about."
 *
 * This is that test.
 *
 * Rules enforced:
 *   R1  O requires every evidence field.
 *   R2  O requires evidence_class ∈ {PUBLICLY_INSPECTABLE, INDEPENDENTLY_ATTESTED}.
 *       PRIVATE_COMMITTED is a commitment, not a verification.
 *   R3  D requires derived_from and support_status.
 *   R4  Support rule: a derived claim cannot carry stronger support than its
 *       weakest factual premise.
 *   R5  A requires a named precondition.
 *   R6  derived_from must reference claims that exist.
 *   R7  No cycles in derived_from.
 */

export const STATE = Object.freeze({
  O: 'O',
  O_PENDING: 'O-PENDING',
  D: 'D',
  A: 'A',
});

export const EVIDENCE_CLASS = Object.freeze({
  PUBLICLY_INSPECTABLE: 'PUBLICLY_INSPECTABLE',
  PRIVATE_COMMITTED: 'PRIVATE_COMMITTED',
  INDEPENDENTLY_ATTESTED: 'INDEPENDENTLY_ATTESTED',
});

const EVIDENCE_FIELDS = [
  'evidence_ref',
  'repository',
  'artifact_sha256',
  'observed_at',
  'observer',
  'scope',
  'evidence_class',
  'revalidate_at',
];

/** Support strength, ordered. A derived claim is capped at its weakest premise. */
const STRENGTH = { O: 3, 'O-PENDING': 2, D: 1, A: 0, SPEC: 1, NONE: 0 };

const strengthOf = (s) => (s in STRENGTH ? STRENGTH[s] : 0);

const VALID_SUPPORT = ['O', 'O-PENDING', 'D', 'A', 'SPEC', 'NONE'];

export function lintClaimMap(claims) {
  if (!Array.isArray(claims)) {
    throw new TypeError('lintClaimMap expects an array of claims');
  }
  const findings = [];
  const byId = new Map();

  // R8 — duplicate ids make derived_from ambiguous
  for (const c of claims) {
    const id = String(c.id);
    if (byId.has(id)) {
      findings.push({ id, rule: 'R8', message: `duplicate claim id ${id}` });
    } else {
      byId.set(id, c);
    }
  }

  const fail = (id, rule, message) => findings.push({ id: String(id), rule, message });

  for (const c of claims) {
    const id = String(c.id);
    if (c.withdrawn) continue;

    if (!Object.values(STATE).includes(c.state)) {
      fail(id, 'R0', `unknown state ${JSON.stringify(c.state)}`);
      continue;
    }

    // R1 / R2 — observations must be resolvable by a third party
    if (c.state === STATE.O) {
      for (const f of EVIDENCE_FIELDS) {
        if (!c[f] || String(c[f]).trim() === '') {
          fail(id, 'R1', `state O requires ${f}`);
        }
      }
      if (
        c.evidence_class &&
        c.evidence_class !== EVIDENCE_CLASS.PUBLICLY_INSPECTABLE &&
        c.evidence_class !== EVIDENCE_CLASS.INDEPENDENTLY_ATTESTED
      ) {
        fail(
          id,
          'R2',
          `state O requires PUBLICLY_INSPECTABLE or INDEPENDENTLY_ATTESTED, got ${c.evidence_class}`
        );
      }
    }

    // R3 — derived claims declare their premises
    if (c.state === STATE.D) {
      if (!Array.isArray(c.derived_from)) {
        fail(id, 'R3', 'state D requires derived_from (may be an empty array)');
      }
      if (!c.support_status) {
        fail(id, 'R3', 'state D requires support_status');
      } else if (!VALID_SUPPORT.includes(c.support_status)) {
        // R9 — an unrecognised support value silently scores 0 and would let
        // any derived claim pass the support rule
        fail(id, 'R9', `unknown support_status ${JSON.stringify(c.support_status)}`);
      }
      // R10 — a claim with no premises is not derived from anything; it must
      // declare SPEC or NONE rather than a factual support level
      if (
        Array.isArray(c.derived_from) &&
        c.derived_from.length === 0 &&
        !['SPEC', 'NONE'].includes(c.support_status)
      ) {
        fail(
          id,
          'R10',
          `state D with empty derived_from requires support_status SPEC or NONE, got ${c.support_status}`
        );
      }
    }

    // R5 — open claims name what would close them
    if (c.state === STATE.A && !c.precondition) {
      fail(id, 'R5', 'state A requires a named precondition');
    }

    // R6 — premises must exist
    for (const ref of c.derived_from ?? []) {
      if (!byId.has(String(ref))) {
        fail(id, 'R6', `derived_from references unknown claim ${ref}`);
      }
    }
  }

  // R7 — no cycles
  const seen = new Map();
  const visit = (id, stack) => {
    if (stack.includes(id)) {
      fail(id, 'R7', `cycle in derived_from: ${[...stack, id].join(' → ')}`);
      return;
    }
    if (seen.get(id)) return;
    seen.set(id, true);
    const c = byId.get(id);
    for (const ref of c?.derived_from ?? []) visit(String(ref), [...stack, id]);
  };
  for (const c of claims) if (!c.withdrawn) visit(String(c.id), []);

  // R4 — the support rule, computed after existence and cycles are known
  for (const c of claims) {
    if (c.withdrawn || c.state !== STATE.D) continue;
    const premises = c.derived_from ?? [];
    if (premises.length === 0) continue;

    let weakest = Infinity;
    let weakestId = null;
    for (const ref of premises) {
      const p = byId.get(String(ref));
      if (!p) continue;
      const s = strengthOf(p.state);
      if (s < weakest) {
        weakest = s;
        weakestId = String(ref);
      }
    }
    if (weakestId === null) continue;

    const declared = strengthOf(c.support_status);
    if (declared > weakest) {
      fail(
        String(c.id),
        'R4',
        `support_status ${c.support_status} is stronger than weakest premise ` +
          `(claim ${weakestId}, state ${byId.get(weakestId).state})`
      );
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    counts: countStates(claims),
  };
}

export function countStates(claims) {
  const counts = { O: 0, 'O-PENDING': 0, D: 0, A: 0, withdrawn: 0 };
  for (const c of claims) {
    if (c.withdrawn) counts.withdrawn++;
    else if (c.state in counts) counts[c.state]++;
  }
  return counts;
}

/**
 * Parses the markdown table form used in CLAIM_MAP_readme_v*.md.
 * Deliberately conservative: it extracts id, claim, state and level, and leaves
 * the structured evidence fields to a sidecar. A map that only exists as prose
 * cannot be linted properly — which is itself the argument for keeping the
 * canonical form as data.
 */
export function parseMarkdownClaims(md) {
  const rows = [];
  const re = /^\|\s*(~~)?([A-Za-z]{0,2}[0-9]+[a-z]?)(~~)?\s*\|(.+?)\|\s*\*?\*?(O-PENDING|O|D|A|—)\*?\*?\s*\|\s*([0-9]|—)\s*\|/gm;
  let m;
  while ((m = re.exec(md)) !== null) {
    const withdrawn = Boolean(m[1]);
    rows.push({
      id: m[2],
      claim: m[4].replace(/\*\*/g, '').trim(),
      state: m[5] === '—' ? null : m[5],
      level: m[6] === '—' ? null : Number(m[6]),
      withdrawn,
    });
  }
  return rows;
}
