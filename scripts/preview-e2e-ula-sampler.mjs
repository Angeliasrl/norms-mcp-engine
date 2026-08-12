// Campionatore ULA (round produzione 0.6.0, P2/P3): con la guardia ancora
// strict, ogni official_url in domain allowlist produce il rifiuto tipizzato
// "Indirizzo non pubblico non ammesso: <ip>" — l'ip è la risoluzione DNS
// INTERNA al container per quell'host. Campiona tutti gli host allowlist e
// calcola il prefisso comune più stretto: quello (e solo quello) verrà
// pinnato in NORMS_CF_EGRESS_ULA_PREFIX. Nessuna stima: solo osservazioni.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const [baseUrl, outputPath] = process.argv.slice(2);
assert.ok(baseUrl && outputPath, 'usage: sampler <preview-url> <output.json>');
const normalized = baseUrl.replace(/\/$/, '');

const HOSTS = [
  'www.gazzettaufficiale.it', 'gazzettaufficiale.it',
  'api.normattiva.it', 'www.normattiva.it', 'normattiva.it', 'dati.normattiva.it',
  'eur-lex.europa.eu', 'data.europa.eu', 'publications.europa.eu', 'op.europa.eu',
];

const samples = [];
for (const host of HOSTS) {
  const response = await fetch(`${normalized}/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      official_url: `https://${host}/`, jurisdiction: 'IT',
      source_requirements: {}, request_id: `ula-sample-${host.replaceAll('.', '-')}`,
    }),
  });
  const text = await response.text();
  const match = /non ammesso: ([0-9a-f:.]+)/i.exec(text);
  samples.push({ host, http_status: response.status, resolved_ip: match?.[1] ?? null, raw: text.slice(0, 200) });
}

const addresses = samples.map((s) => s.resolved_ip).filter(Boolean);
assert.ok(addresses.length > 0, 'nessun campione ULA raccolto');

// Prefisso comune più stretto tra gli indirizzi IPv6 osservati.
const expand = (ip) => {
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  return groups.map((g) => parseInt(g || '0', 16));
};
const bits = (ip) => expand(ip).map((g) => g.toString(2).padStart(16, '0')).join('');
const bitStrings = addresses.map(bits);
let common = 0;
while (common < 128 && bitStrings.every((b) => b[common] === bitStrings[0][common])) common += 1;
// Arrotonda al nibble e non superare /64 di specificità (stabilità operativa).
const prefixLen = Math.min(Math.floor(common / 4) * 4, 64);
const groups = [];
const firstBits = bitStrings[0].slice(0, prefixLen).padEnd(128, '0');
for (let i = 0; i < 8; i += 1) groups.push(parseInt(firstBits.slice(i * 16, (i + 1) * 16), 2).toString(16));
const prefix = `${groups.join(':').replace(/(:0)+$/, '::')}/${prefixLen}`;

const report = { schema_version: 'norms-cf-egress-ula-samples/0.1', sampled_at_utc: new Date().toISOString(), samples, computed_prefix: prefix };
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`samples=${addresses.length} prefix=${prefix}`);
