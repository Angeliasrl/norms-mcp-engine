import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertProductionConfigFreeze } from './production-config-freeze.mjs';

const config = JSON.parse(await readFile(new URL('../wrangler.preview-0.5.3-0.2.2.jsonc', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../preview/cloudflare-preview-image-lock-0.5.3-0.2.2.json', import.meta.url), 'utf8'));

assert.equal(config.name, 'norms-mcp-preview-0-2-2-pipeline-0-5-3');
assert.equal(config.workers_dev, true);
assert.equal(config.routes, undefined);
assert.equal(config.containers[0].name, 'norms-resolver-preview-0-5-3');
assert.equal(config.containers[0].image, lock.image);
assert.equal(lock.manifest_digest, 'sha256:92835dd5c86e730250f586a7dee2ddab04f961bd5dc6ad726ca5ec743a63b73c');
assert.equal(lock.config_digest, 'sha256:a212783267c2e5da566ae8c9402b8b8bf0744f9794de898396d748eb604bb034');
assert.equal(lock.platform, 'linux/amd64');
assert.equal(lock.size_bytes, 236076302);
assert.equal(config.r2_buckets[0].bucket_name, 'norms-pdf-uploads-preview-0-2-2-pipeline-0-5-3');
assert.equal(config.vars.PDF_ATTACHMENT_PROBE_ENABLED, 'true');
assert(!JSON.stringify(config).includes('PDF_UPLOAD_CAPABILITY_HMAC_KEY'));
await assertProductionConfigFreeze();
console.log('cloudflare-preview-0.5.3-0.2.2: PASS');
