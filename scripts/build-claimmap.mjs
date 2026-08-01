#!/usr/bin/env node
/**
 * Generates CLAIM_MAP.md from claims.mjs.
 *
 * The suite calls renderClaimMap() and compares its output against the
 * committed file. If they differ, the test fails: the Markdown cannot drift
 * from the data.
 *
 *   node scripts/build-claimmap.mjs          # write CLAIM_MAP.md
 *   node scripts/build-claimmap.mjs --check  # exit 1 if it would change
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { claims, sections, meta, prose } from '../claims.mjs';
import { lintClaimMap } from '../src/claimmap.js';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'CLAIM_MAP.md');

const esc = (s) => String(s).replace(/\|/g, '\\|');

export function renderClaimMap() {
  const L = [];
  L.push(`# CLAIM MAP — ${meta.package} ${meta.version}`);
  L.push('');
  L.push('> **Generated from `claims.mjs`. Do not edit by hand.**');
  L.push('> `node scripts/build-claimmap.mjs` regenerates it; the test suite fails if this');
  L.push('> file has drifted from the data.');
  L.push('');
  L.push('## Scope of this map');
  L.push('');
  L.push(meta.scope);
  L.push('');
  L.push('## The axes');
  L.push('');
  L.push('| State | |');
  L.push('|---|---|');
  L.push('| **O** | Observed, with a reference a third party can resolve now. |');
  L.push('| **O-PENDING** | Reported observation. The fact happened; the reference is not resolvable. **Not admissible as evidence.** |');
  L.push('| **D** | Derived from stated premises, whose state is declared. |');
  L.push('| **A** | Open. Blocked on a fact that has not occurred. Precondition named. |');
  L.push('');
  L.push('**Construction level**: 1 conceptual · 2 documented/specified · 3 prototype · 4 limited operation · 5 full operation · 6 independently verified.');
  L.push('');
  L.push('**Support rule.** A derived claim cannot carry stronger evidentiary support than its weakest factual premise. Enforced by R4 of the linter in this package.');
  L.push('');

  for (const s of sections) {
    const rows = claims.filter((c) => c.section === s.id);
    if (rows.length === 0) continue;
    L.push('---');
    L.push('');
    L.push(`## ${s.title}`);
    L.push('');
    L.push('| # | Claim | State | Lvl | Support / evidence |');
    L.push('|---|---|---|---|---|');
    for (const c of rows) {
      const bits = [];
      if (Array.isArray(c.derived_from)) {
        bits.push(
          `\`derived_from: [${c.derived_from.join(', ')}]\` · \`support_status: ${c.support_status}\``
        );
      }
      if (c.precondition) bits.push(`**Precondition:** ${c.precondition}`);
      if (c.note) bits.push(c.note);
      L.push(
        `| ${c.id} | ${esc(c.claim)} | **${c.state}** | ${c.level ?? '—'} | ${esc(bits.join(' '))} |`
      );
    }
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('## Evidence debt');
  L.push('');
  L.push(prose.evidenceDebt);
  L.push('');
  L.push('## Note on under-claiming');
  L.push('');
  L.push(prose.underClaiming);
  L.push('');

  const counts = claims.reduce((a, c) => ((a[c.state] = (a[c.state] ?? 0) + 1), a), {});
  L.push('## Counts');
  L.push('');
  L.push(
    Object.entries(counts)
      .sort()
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
  );
  L.push('');
  return L.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('build-claimmap.mjs')) {
  const lint = lintClaimMap(claims);
  if (!lint.ok) {
    console.error('claim map does not lint:');
    for (const f of lint.findings) console.error(`  ${f.id} [${f.rule}] ${f.message}`);
    process.exit(1);
  }
  const rendered = renderClaimMap();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      /* missing file counts as drift */
    }
    if (current !== rendered) {
      console.error('CLAIM_MAP.md has drifted from claims.mjs. Run: node scripts/build-claimmap.mjs');
      process.exit(1);
    }
    console.log('CLAIM_MAP.md is in sync with claims.mjs');
  } else {
    writeFileSync(target, rendered, 'utf8');
    console.log(`wrote ${target}`);
  }
}
