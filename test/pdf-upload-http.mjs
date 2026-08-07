import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { PdfUploadDurableObject } from '../worker/pdf-upload-cloudflare.mjs';
import { createChatGptFileDownloader, handlePdfUploadRequest, pdfUploadClientFromEnv } from '../worker/pdf-upload-http.mjs';

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
    const object = { key, version: 'version-1', etag: 'etag-1', size: bytes.byteLength, bytes };
    objects.set(key, object); return object;
  },
  async head(key) { return objects.get(key) ?? null; },
  async get(key) { const object = objects.get(key); return object ? { ...object, arrayBuffer: async () => object.bytes.slice().buffer } : null; },
  async delete(key) { objects.delete(key); },
};
let containerRequest;
let containerBytes;
Object.assign(env, {
  PDF_UPLOADS: bucket,
  PDF_UPLOAD_COORDINATOR: namespace,
  NORMS_RESOLVER: {
    getByName(name) {
      assert.equal(name, 'norms-resolver-v1');
      return { fetch: async (request) => {
        containerRequest = request;
        const bytes = new Uint8Array(await request.arrayBuffer());
        containerBytes = bytes;
        const byteSha256 = createHash('sha256').update(bytes).digest('hex');
        return Response.json({
          schema_version: request.headers.get('x-norms-pdf-audit-contract'),
          request_id: request.headers.get('x-norms-request-id'),
          byte_sha256: byteSha256,
          document_bundle: {
            bundle_version: '0.2.0',
            source: { mime_type: 'application/pdf', byte_length: bytes.byteLength, byte_sha256: byteSha256, page_count: 1 },
            pages: [{ page: 1, blocks: [{ block_id: 'p1:b1', text: 'Fixture' }] }],
            unreadable_pages: [], warnings: [],
          },
        });
      } };
    },
  },
});

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

let downloadRequest;
const downloader = createChatGptFileDownloader({ fetchImpl: async (url, init) => {
  downloadRequest = { url: String(url), init };
  return new Response(pdf, { headers: { 'content-type': 'application/pdf', 'content-length': String(pdf.byteLength) } });
} });
const downloaded = await downloader({ download_url: 'https://files.example.test/native-file', file_id: 'file-safe', mime_type: 'application/pdf' });
assert.equal(downloaded.byte_length, pdf.byteLength);
assert.equal(downloaded.byte_sha256, createHash('sha256').update(pdf).digest('hex'));
assert.equal(downloadRequest.url, 'https://files.example.test/native-file');
assert.equal(downloadRequest.init.redirect, 'error');
assert.deepEqual(downloadRequest.init.headers, { accept: 'application/pdf' });
assert.equal(downloadRequest.init.headers.authorization, undefined);
await assert.rejects(downloader({ download_url: 'http://files.example.test/file', file_id: 'file-safe' }), (error) => error.code === 'PDF_ATTACHMENT_DOWNLOAD_URL_INVALID');
await assert.rejects(downloader({ download_url: 'https://127.0.0.1/file', file_id: 'file-safe' }), (error) => error.code === 'PDF_ATTACHMENT_DOWNLOAD_URL_INVALID');
await assert.rejects(downloader({ download_url: 'https://files.example.test/file', file_id: 'file-safe', mime_type: 'text/plain' }), (error) => error.code === 'PDF_ATTACHMENT_DESCRIPTOR_INVALID');
const badMagic = createChatGptFileDownloader({ fetchImpl: async () => new Response('not-pdf', { headers: { 'content-type': 'application/pdf' } }) });
await assert.rejects(badMagic({ download_url: 'https://files.example.test/file', file_id: 'file-safe' }), (error) => error.code === 'PDF_MAGIC_INVALID');
const tooLarge = createChatGptFileDownloader({ fetchImpl: async () => new Response(pdf, { headers: { 'content-type': 'application/pdf', 'content-length': String(20 * 1024 * 1024 + 1) } }) });
await assert.rejects(tooLarge({ download_url: 'https://files.example.test/file', file_id: 'file-safe' }), (error) => error.code === 'PDF_TOO_LARGE');

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
const audited = await result.json();
assert.equal(audited.state, 'CONSUMED');
assert.equal(audited.document_bundle.bundle_version, '0.2.0');
assert.equal(containerRequest.method, 'POST');
assert.equal(new URL(containerRequest.url).pathname, '/pdf-audit');
assert.equal(new URL(containerRequest.url).search, '');
assert.deepEqual([...containerRequest.headers.keys()].sort(), [
  'content-type', 'x-content-sha256', 'x-norms-pdf-audit-contract', 'x-norms-request-id',
]);
assert.equal(containerRequest.headers.get('authorization'), null);
assert.equal(containerRequest.headers.get('x-norms-pdf-audit-contract'), 'norms-pdf-audit/0.5.1');
assert.equal(containerRequest.headers.get('x-content-sha256'), uploaded.byte_sha256);
assert.equal(createHash('sha256').update(containerBytes).digest('hex'), uploaded.byte_sha256);

result = await handlePdfUploadRequest(new Request(uploadUrl, {
  method: 'DELETE', headers: { authorization: `Capability ${session.delete_capability}` },
}), env);
assert.equal(result.status, 200);
assert.equal((await result.json()).verified_absent, true);
assert.equal(objects.size, 0);
const record = await stubs.get(session.upload_id).state.storage.get('record');
assert.equal(record.state, 'DELETED');
assert(!JSON.stringify(record).includes(uploadCapability));

const failedSession = await client.create({});
const failedTarget = new URL(failedSession.upload_url, 'https://preview.invalid');
const failedUploadCapability = new URLSearchParams(failedTarget.hash.slice(1)).get('upload_capability');
failedTarget.hash = '';
result = await handlePdfUploadRequest(new Request(failedTarget, {
  method: 'PUT', headers: { authorization: `Capability ${failedUploadCapability}`, 'content-type': 'application/pdf', 'content-length': String(pdf.byteLength) }, body: pdf,
}), env);
assert.equal(result.status, 200);
const failedUpload = await result.json();
result = await handlePdfUploadRequest(new Request(`${failedTarget}/finalize`, {
  method: 'POST', headers: { authorization: `Capability ${failedSession.finalize_capability}`, 'content-type': 'application/json' }, body: JSON.stringify({ expected_sha256: failedUpload.byte_sha256 }),
}), env);
assert.equal(result.status, 200);
env.NORMS_RESOLVER = { fetch: async () => new Response('', { status: 500 }) };
await assert.rejects(client.audit({ uploadId: failedSession.upload_id, capability: failedSession.audit_capability }), (error) => error.code === 'PDF_NORMATIVE_PIPELINE_HTTP_ERROR');
const failedRecord = await stubs.get(failedSession.upload_id).state.storage.get('record');
assert.equal(failedRecord.state, 'FAILED');
assert.notEqual(failedRecord.state, 'CONSUMED');

console.log('pdf-upload-http: PASS');
