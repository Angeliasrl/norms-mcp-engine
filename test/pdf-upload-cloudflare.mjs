import assert from 'node:assert/strict';
import { PdfUploadBoundaryError, PdfUploadDurableObject, createPrivateR2UploadAdapter } from '../worker/pdf-upload-cloudflare.mjs';

class MemoryStorage {
  values = new Map(); alarmAt = null;
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async setAlarm(value) { this.alarmAt = value; }
  async deleteAlarm() { this.alarmAt = null; }
}
const env = { PDF_UPLOAD_CAPABILITY_HMAC_KEY: 'server-only-key-material-that-is-at-least-32-bytes' };
const make = () => new PdfUploadDurableObject({ storage: new MemoryStorage() }, env);
const rejectCode = async (code, promise) => assert.rejects(promise, (error) => error instanceof PdfUploadBoundaryError && error.code === code);

const baseNow = Date.now();
const id = '1'.repeat(64); const stub = make();
const created = await stub.createSession({ uploadId: id, maxBytes: 1000, ttlSeconds: 60, now: baseNow });
const persisted = await stub.state.storage.get('record');
assert.equal(persisted.state, 'CREATED');
assert(!JSON.stringify(persisted).includes(created.capabilities.upload));
assert.equal(new Set(Object.values(created.capabilities)).size, 4);
await rejectCode('CAPABILITY_INVALID', stub.beginUpload({ capability: created.capabilities.audit, declaredLength: 10, now: baseNow + 1 }));
await stub.beginUpload({ capability: created.capabilities.upload, declaredLength: 10, now: baseNow + 1 });
await rejectCode('CAPABILITY_REPLAYED', stub.beginUpload({ capability: created.capabilities.upload, declaredLength: 10, now: baseNow + 1 }));
await stub.completeUpload({ r2Version: 'v1', r2Etag: 'e1', byteLength: 10 });
await rejectCode('R2_OBJECT_DIVERGED', stub.recordInspection({ byteSha256: 'a'.repeat(64), r2Version: 'v2', r2Etag: 'e1' }));

const good = make(); const goodCreated = await good.createSession({ uploadId: '2'.repeat(64), maxBytes: 1000, ttlSeconds: 60, now: baseNow });
await good.beginUpload({ capability: goodCreated.capabilities.upload, declaredLength: 10, now: baseNow + 1 });
await good.completeUpload({ r2Version: 'v1', r2Etag: 'e1', byteLength: 10 });
await good.recordInspection({ byteSha256: 'b'.repeat(64), r2Version: 'v1', r2Etag: 'e1' });
await good.finalize({ capability: goodCreated.capabilities.finalize, now: baseNow + 2 });
await rejectCode('CAPABILITY_REPLAYED', good.finalize({ capability: goodCreated.capabilities.finalize, now: baseNow + 2 }));
await good.beginAudit({ capability: goodCreated.capabilities.audit, now: baseNow + 3 });
await rejectCode('CAPABILITY_REPLAYED', good.beginAudit({ capability: goodCreated.capabilities.audit, now: baseNow + 3 }));
assert.equal((await good.delete({ capability: goodCreated.capabilities.delete, now: baseNow + 4 })).state, 'DELETED');
assert.equal((await good.delete({ capability: goodCreated.capabilities.delete, now: baseNow + 5 })).state, 'DELETED');

const expired = make(); const expiredCreated = await expired.createSession({ uploadId: '3'.repeat(64), maxBytes: 100, ttlSeconds: 1, now: baseNow });
await rejectCode('CAPABILITY_EXPIRED', expired.beginUpload({ capability: expiredCreated.capabilities.upload, declaredLength: 10, now: baseNow + 1001 }));
assert.equal((await expired.state.storage.get('record')).state, 'EXPIRED');

let currentStub; const objects = new Map(); let sequence = 3;
const namespace = {
  newUniqueId: () => ({ toString: () => `${++sequence}`.repeat(64).slice(0, 64) }),
  idFromString: (value) => value,
  get: () => currentStub,
};
const bucket = {
  async put(key, body) { const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer()); const value = { key, version: 'rv1', etag: 're1', size: bytes.byteLength }; objects.set(key, value); return value; },
  async head(key) { return objects.get(key) ?? null; },
  async delete(key) { objects.delete(key); },
};
currentStub = make(); const adapter = createPrivateR2UploadAdapter({ bucket, namespace, maxBytes: 100, ttlSeconds: 60 });
const cloud = await adapter.create();
assert(!cloud.upload_url.includes('?'));
await rejectCode('CAPABILITY_QUERY_REJECTED', adapter.put({ uploadId: cloud.upload_id, capability: cloud.upload_url.split('=').at(-1), body: new Uint8Array(10), declaredLength: 10, queryCapabilityPresent: true }));
const uploadCapability = cloud.upload_url.split('=').at(-1);
await adapter.put({ uploadId: cloud.upload_id, capability: uploadCapability, body: new Uint8Array(10), declaredLength: 10 });
await adapter.recordInspection({ uploadId: cloud.upload_id, byteSha256: 'c'.repeat(64), r2Version: 'rv1', r2Etag: 're1' });
await adapter.finalize({ uploadId: cloud.upload_id, capability: cloud.finalize_capability });
objects.clear();
await rejectCode('R2_OBJECT_MISSING', adapter.verifyForAudit({ uploadId: cloud.upload_id, capability: cloud.audit_capability }));

currentStub = make(); const replaced = await adapter.create(); const replacedUpload = replaced.upload_url.split('=').at(-1);
await adapter.put({ uploadId: replaced.upload_id, capability: replacedUpload, body: new Uint8Array(10), declaredLength: 10 });
await adapter.recordInspection({ uploadId: replaced.upload_id, byteSha256: 'd'.repeat(64), r2Version: 'rv1', r2Etag: 're1' });
await adapter.finalize({ uploadId: replaced.upload_id, capability: replaced.finalize_capability });
const replacedRecord = await currentStub.state.storage.get('record');
objects.set(replacedRecord.object_key, { key: replacedRecord.object_key, version: 'attacker-version', etag: 'attacker-etag', size: 10 });
await rejectCode('R2_OBJECT_DIVERGED', adapter.verifyForAudit({ uploadId: replaced.upload_id, capability: replaced.audit_capability }));

currentStub = make(); const wrongLength = await adapter.create();
await rejectCode('R2_LENGTH_DIVERGED', adapter.put({
  uploadId: wrongLength.upload_id, capability: wrongLength.upload_url.split('=').at(-1), body: new Uint8Array(9), declaredLength: 10,
}));

console.log('pdf-upload-cloudflare: PASS');
