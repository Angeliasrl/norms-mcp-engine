import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const configPath = new URL('../wrangler.preview-0.5.1-0.2.1.jsonc', import.meta.url);
const lockPath = new URL('../preview/cloudflare-preview-image-lock-0.5.1-0.2.1.json', import.meta.url);
const productionPath = new URL('../wrangler.jsonc', import.meta.url);
const config = JSON.parse(await readFile(configPath, 'utf8'));
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
const production = await readFile(productionPath);

assert.equal(config.name, 'norms-mcp-preview-0-2-1-pipeline-0-5-1');
assert.equal(config.workers_dev, true);
assert.equal(config.preview_urls, false);
assert.equal(config.routes, undefined);
assert.equal(config.containers.length, 1);
assert.deepEqual(config.containers[0], {
  name: 'norms-resolver-preview-0-5-1',
  class_name: 'NormsResolverContainer',
  image: lock.image,
  max_instances: 1,
  instance_type: 'basic',
});
assert.match(config.containers[0].image, /^registry\.cloudflare\.com\/.+@sha256:[0-9a-f]{64}$/);
assert(!config.containers[0].image.includes(':latest'));
assert.equal(lock.manifest_digest, config.containers[0].image.split('@').at(-1));
assert.equal(lock.pipeline_commit, '9cf6a42104a4f1b6adcb1082bd40b1b7b0ccf8cb');
assert.equal(lock.publication_commit, '2017f86d3213ddc29b29644c10e27f10d4df4271');
assert.equal(lock.config_digest, 'sha256:d330714f554f80a5349f05ceee6e2804edfc8bc5767496760e48fe7c28f0c1a6');
assert.equal(lock.platform, 'linux/amd64');
assert.equal(lock.size_bytes, 194422321);
assert.equal(lock.publication.github_run_id, 31189185724);
assert.equal(lock.publication.github_artifact_id, 8998082690);
assert.equal(lock.publication.attestation_sha256, 'd84d6bd41294a501f542a9e7cf538f8723c166eb93ff862776ee9b27182aff63');
assert.equal(lock.publication.sbom_sha256, '00398fac38eff8cb0a914c7229883702dfddaeda4aa09b6f7b9b0a26d6b27074');

const bindings = new Map(config.durable_objects.bindings.map((item) => [item.name, item.class_name]));
assert.equal(bindings.get('NORMS_RESOLVER'), 'NormsResolverContainer');
assert.equal(bindings.get('PDF_UPLOAD_COORDINATOR'), 'PdfUploadDurableObject');
assert.deepEqual(config.r2_buckets, [{
  binding: 'PDF_UPLOADS',
  bucket_name: 'norms-pdf-uploads-preview-0-2-1-pipeline-0-5-1',
}]);
assert.equal(config.vars.ENVIRONMENT, 'preview');
assert.equal(config.vars.PDF_ATTACHMENT_PROBE_ENABLED, 'true');
assert(!JSON.stringify(config).includes('PDF_UPLOAD_CAPABILITY_HMAC_KEY'));
assert(config.migrations[0].new_sqlite_classes.includes('PdfUploadDurableObject'));
// Freeze della wrangler.jsonc di produzione. Ri-baselinato con l'attivazione
// §7 (RATIFICA_ATTIVAZIONE_0.6.0_S7_01): image 0.6.0-fix, service binding
// NORMS_DB_RESOLVER, vars canale+ULA. Baseline 0.5.4 precedente:
// 4840e9e363007bcbdd7ab886f564223d9a0bd3b6ed7307e63de9a48b0bfac0bd
assert.equal(createHash('sha256').update(production).digest('hex'), 'edccc1de64c95503505b2451c397a70e7c99be8b096335a658b7ff57aa6d4685');
console.log('cloudflare-preview-substrate: PASS');
