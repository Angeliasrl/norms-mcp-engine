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
assert.equal(lock.pipeline_commit, '28dcef02a212eb303e4bab9fd8257c99376cda7d');
assert.equal(lock.config_digest, 'sha256:4fcb5a3dde0946b210d3083839621f74e29dd7a7b4d59c9fc541935e41a9bc09');
assert.equal(lock.platform, 'linux/amd64');
assert.equal(lock.size_bytes, 194393664);
assert.equal(lock.publication.github_artifact_id, 8988347613);
assert.equal(lock.publication.github_run_id, 31162069593);
assert.equal(lock.publication.github_run_attempt, 4);
assert.equal(lock.publication.attestation_sha256, '29f26be25f17ba54bc8f6958c557a20deb5d6abf3037dfd31dfc447c77a7c8d2');
assert.equal(lock.publication.sbom_sha256, '532b47936b3560da763cd63e69982dc4ee60d65f1547c4bd9d4f1af86d50609d');

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
assert.equal(createHash('sha256').update(production).digest('hex'), '8dd7bb5abb332d37b950fed179be27c57a11d40d5daccd8c40a622dc72d8e858');
console.log('cloudflare-preview-substrate: PASS');
