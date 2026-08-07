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
assert.equal(lock.pipeline_commit, 'eb0d10ea672a1318dd6938882b67e1d1e4f0f159');
assert.equal(lock.publication_commit, '000e5f9eac4449f59f2ad1c7f654a97849186bdc');
assert.equal(lock.config_digest, 'sha256:c9d589ebd2bd90333302ac4016213c21d61cf25f42014c324efb65d08a0d15ad');
assert.equal(lock.platform, 'linux/amd64');
assert.equal(lock.size_bytes, 194410226);
assert.equal(lock.publication.github_run_id, 31167525217);
assert.equal(lock.publication.attestation_sha256, '6684df19618569c1d690e056ebed0fb5e0816a1a5b10ccc0dcfc11038de75454');
assert.equal(lock.publication.sbom_sha256, 'c5bfb388e866f24250a5aa2823cede03d9b92a0288ed6bef62d88ca91ef2fda4');

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
