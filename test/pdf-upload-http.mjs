import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PdfUploadDurableObject } from '../worker/pdf-upload-cloudflare.mjs';
import { handlePdfUploadRequest, pdfUploadClientFromEnv } from '../worker/pdf-upload-http.mjs';

const workerSources = `${await readFile(new URL('../worker/index.mjs', import.meta.url), 'utf8')}\n${await readFile(new URL('../worker/pdf-upload-http.mjs', import.meta.url), 'utf8')}`;
assert(!workerSources.includes('console.'));
assert(!workerSources.includes('searchParams.get'));
assert(!workerSources.includes('PDF_UPLOAD_CAPABILITY_HMAC_KEY ??'));

class MemoryStorage {
  values = new Map();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async setAlarm(value) { this.alarm = value; }
  async deleteAlarm() { this.alarm = undefined; }
}

const secret = 'preview-test-key-material-at-least-thirty-two-bytes';
const stubs = new Map();
let sequence = 0;
const id = () => `${++sequence}`.repeat(64).slice(0, 64);
const env = { PDF_UPLOAD_CAPABILITY_HMAC_KEY: secret };
const namespace = {
  newUniqueId() { const value = id(); return { toString: () => value }; },
  idFromString(value) { return { toString: () => value }; },
  get(identifier) {
    const key = identifier.toString();
    if (!stubs.has(key)) stubs.set(key, new PdfUploadDurableObject({ storage: new MemoryStorage() }, env));
    return stubs.get(key);
  },
};
const objects = new Map();
const bucket = {
  async put(key, body) {
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
    const object = { key, version: 'version-1', etag: 'etag-1', size: bytes.byteLength };
    objects.set(key, object); return object;
  },
  async head(key) { return objects.get(key) ?? null; },
  async delete(key) { objects.delete(key); },
};
Object.assign(env, { PDF_UPLOADS: bucket, PDF_UPLOAD_COORDINATOR: namespace });

assert.throws(() => pdfUploadClientFromEnv({}), /Private upload bindings/);
assert.throws(() => pdfUploadClientFromEnv({ PDF_UPLOADS: bucket, PDF_UPLOAD_COORDINATOR: namespace }), /server-side capability key/);

const client = pdfUploadClientFromEnv(env);
const session = await client.create({});
const uploadUrl = new URL(session.upload_url, 'https://preview.invalid');
const uploadCapability = new URLSearchParams(uploadUrl.hash.slice(1)).get('upload_capability');
assert(uploadCapability);
assert.equal(uploadUrl.search, '');
uploadUrl.hash = '';
const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');

let result = await handlePdfUploadRequest(new Request(`${uploadUrl}?capability=${uploadCapability}`, {
  method: 'PUT', headers: { authorization: `Capability ${uploadCapability}`, 'content-length': String(pdf.byteLength) }, body: pdf,
}), env);
assert.equal(result.status, 400);
assert.equal((await result.json()).error.code, 'CAPABILITY_QUERY_REJECTED');

result = await handlePdfUploadRequest(new Request(uploadUrl, {
  method: 'PUT', headers: { authorization: `Capability ${uploadCapability}`, 'content-type': 'application/pdf', 'content-length': String(pdf.byteLength) }, body: pdf,
}), env);
assert.equal(result.status, 200);
const uploaded = await result.json();
assert.match(uploaded.byte_sha256, /^[0-9a-f]{64}$/);
assert(!JSON.stringify(uploaded).includes(uploadCapability));

result = await handlePdfUploadRequest(new Request(`${uploadUrl}/finalize`, {
  method: 'POST', headers: { authorization: `Capability ${session.finalize_capability}`, 'content-type': 'application/json' }, body: JSON.stringify({ expected_sha256: uploaded.byte_sha256 }),
}), env);
assert.equal(result.status, 200);
assert.equal((await result.json()).state, 'FINALIZED');

result = await handlePdfUploadRequest(new Request(`${uploadUrl}/audit`, {
  method: 'POST', headers: { authorization: `Capability ${session.audit_capability}` },
}), env);
assert.equal(result.status, 200);
assert.equal((await result.json()).state, 'CONSUMED');

result = await handlePdfUploadRequest(new Request(uploadUrl, {
  method: 'DELETE', headers: { authorization: `Capability ${session.delete_capability}` },
}), env);
assert.equal(result.status, 200);
assert.equal((await result.json()).verified_absent, true);
assert.equal(objects.size, 0);
const record = await stubs.get(session.upload_id).state.storage.get('record');
assert.equal(record.state, 'DELETED');
assert(!JSON.stringify(record).includes(uploadCapability));

console.log('pdf-upload-http: PASS');
