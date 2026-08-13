import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Freeze della wrangler.jsonc di PRODUZIONE — UNICA fonte dell'hash atteso.
// Quando la config di produzione cambia legittimamente (per una ratifica),
// aggiornare l'hash SOLO qui: entrambi i consumatori (npm test via
// cloudflare-preview-substrate.mjs, step CI via cloudflare-preview-0.5.3-0.2.2.mjs)
// importano questa costante, e lo stesso comando `node test/production-config-freeze.mjs`
// gira in ENTRAMBE le liste. Baseline precedenti:
//   0.5.4:                      4840e9e363007bcbdd7ab886f564223d9a0bd3b6ed7307e63de9a48b0bfac0bd
//   0.6.0 §7 (S7_01, corrente): edccc1de64c95503505b2451c397a70e7c99be8b096335a658b7ff57aa6d4685
export const PRODUCTION_CONFIG_SHA256 = 'edccc1de64c95503505b2451c397a70e7c99be8b096335a658b7ff57aa6d4685';

export async function assertProductionConfigFreeze() {
  const production = await readFile(new URL('../wrangler.jsonc', import.meta.url));
  assert.equal(createHash('sha256').update(production).digest('hex'), PRODUCTION_CONFIG_SHA256);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await assertProductionConfigFreeze();
  console.log('production-config-freeze: PASS');
}
