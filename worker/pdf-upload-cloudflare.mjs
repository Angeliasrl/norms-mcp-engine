import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const PDF_UPLOAD_STATES = Object.freeze([
  'CREATED', 'UPLOADING', 'UPLOADED', 'FINALIZED', 'AUDITING', 'CONSUMED', 'DELETED',
  'EXPIRED', 'REJECTED', 'FAILED',
]);
export const PDF_CAPABILITY_SCOPES = Object.freeze(['upload', 'finalize', 'audit', 'delete']);
const TERMINAL = new Set(['CONSUMED', 'DELETED', 'EXPIRED', 'REJECTED', 'FAILED']);

export class PdfUploadBoundaryError extends Error {
  constructor(code, message) { super(message); this.name = 'PdfUploadBoundaryError'; this.code = code; }
}

const token = () => randomBytes(32).toString('base64url');
const digest = (secret, uploadId, scope, value) => createHmac('sha256', secret)
  .update(`norms-pdf-capability-v1\0${uploadId}\0${scope}\0${value}`)
  .digest();
const safeEqual = (left, right) => {
  const expected = Buffer.from(left, 'hex');
  const supplied = Buffer.from(right, 'hex');
  const equalLength = expected.byteLength === supplied.byteLength;
  return timingSafeEqual(equalLength ? expected : supplied, supplied) && equalLength;
};
const opaqueObjectKey = () => `pdf/${randomBytes(32).toString('base64url')}`;

function requireSecret(env) {
  const secret = env?.PDF_UPLOAD_CAPABILITY_HMAC_KEY;
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new PdfUploadBoundaryError('CAPABILITY_KEY_NOT_CONFIGURED', 'A server-side capability HMAC key of at least 256 bits is required.');
  }
  return secret;
}

function authorize(record, secret, scope, value, now, consume) {
  const item = record.capabilities?.[scope];
  const actual = digest(secret, record.upload_id, scope, typeof value === 'string' ? value : '').toString('hex');
  const expected = item?.digest ?? '00'.repeat(32);
  if (item && now >= item.expires_at) throw new PdfUploadBoundaryError('CAPABILITY_EXPIRED', 'Capability expired.');
  if (!item || !safeEqual(expected, actual) || item.revoked) throw new PdfUploadBoundaryError('CAPABILITY_INVALID', 'Capability is invalid for this scope.');
  if (item.one_use && item.consumed) throw new PdfUploadBoundaryError('CAPABILITY_REPLAYED', 'One-use capability was already consumed.');
  if (consume) item.consumed = true;
}

/** Durable Object contract. One instance is the coordination atom for one upload. */
export class PdfUploadDurableObject {
  constructor(state, env) { this.state = state; this.env = env; }

  async createSession({ uploadId, maxBytes, ttlSeconds, now = Date.now() }) {
    if (await this.state.storage.get('record')) throw new PdfUploadBoundaryError('UPLOAD_ALREADY_EXISTS', 'Upload state already exists.');
    const secret = requireSecret(this.env);
    const values = Object.fromEntries(PDF_CAPABILITY_SCOPES.map((scope) => [scope, token()]));
    const expiresAt = now + ttlSeconds * 1000;
    const record = {
      schema_version: 'norms-pdf-upload-state/0.1', upload_id: uploadId, object_key: opaqueObjectKey(),
      state: 'CREATED', max_bytes: maxBytes, expires_at: expiresAt, byte_length: null, byte_sha256: null,
      r2_version: null, r2_etag: null,
      capabilities: Object.fromEntries(PDF_CAPABILITY_SCOPES.map((scope) => [scope, {
        digest: digest(secret, uploadId, scope, values[scope]).toString('hex'), expires_at: expiresAt,
        one_use: scope !== 'delete', consumed: false, revoked: false,
      }])),
    };
    await this.state.storage.put('record', record);
    await this.state.storage.setAlarm(expiresAt);
    return { upload_id: uploadId, object_key: record.object_key, expires_at: expiresAt, capabilities: values };
  }

  async _record(now = Date.now()) {
    const record = await this.state.storage.get('record');
    if (!record) throw new PdfUploadBoundaryError('UPLOAD_NOT_FOUND', 'Upload state does not exist.');
    if (now >= record.expires_at && !TERMINAL.has(record.state)) {
      record.state = 'EXPIRED';
      Object.values(record.capabilities).forEach((item) => { item.revoked = true; });
      await this.state.storage.put('record', record);
    }
    return record;
  }

  async beginUpload({ capability, declaredLength, now = Date.now() }) {
    const record = await this._record(now); authorize(record, requireSecret(this.env), 'upload', capability, now, true);
    if (record.state !== 'CREATED') throw new PdfUploadBoundaryError('STATE_TRANSITION_REJECTED', 'Upload requires CREATED.');
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > record.max_bytes) {
      record.state = 'REJECTED'; await this.state.storage.put('record', record);
      throw new PdfUploadBoundaryError('PDF_TOO_LARGE', 'Declared length is absent or outside the configured limit.');
    }
    record.state = 'UPLOADING'; await this.state.storage.put('record', record);
    return { object_key: record.object_key, max_bytes: record.max_bytes };
  }

  async completeUpload({ r2Version, r2Etag, byteLength }) {
    const record = await this._record();
    if (record.state !== 'UPLOADING') throw new PdfUploadBoundaryError('STATE_TRANSITION_REJECTED', 'Upload completion requires UPLOADING.');
    if (!r2Version || !r2Etag || !Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > record.max_bytes) {
      record.state = 'FAILED'; await this.state.storage.put('record', record);
      throw new PdfUploadBoundaryError('R2_METADATA_INVALID', 'R2 upload metadata is incomplete.');
    }
    Object.assign(record, { state: 'UPLOADED', r2_version: r2Version, r2_etag: r2Etag, byte_length: byteLength });
    await this.state.storage.put('record', record); return { state: record.state, object_key: record.object_key };
  }

  async recordInspection({ byteSha256, r2Version, r2Etag }) {
    const record = await this._record();
    if (record.state !== 'UPLOADED' || r2Version !== record.r2_version || r2Etag !== record.r2_etag || !/^[0-9a-f]{64}$/.test(byteSha256)) {
      record.state = 'FAILED'; await this.state.storage.put('record', record);
      throw new PdfUploadBoundaryError('R2_OBJECT_DIVERGED', 'Inspected object does not match stored R2 metadata.');
    }
    record.byte_sha256 = byteSha256; await this.state.storage.put('record', record); return { state: record.state, byte_sha256: byteSha256 };
  }

  async finalize({ capability, expectedSha256, now = Date.now() }) {
    const record = await this._record(now); authorize(record, requireSecret(this.env), 'finalize', capability, now, true);
    if (record.state !== 'UPLOADED' || !record.byte_sha256) throw new PdfUploadBoundaryError('STATE_TRANSITION_REJECTED', 'Finalize requires inspected UPLOADED bytes.');
    if (expectedSha256 && expectedSha256 !== record.byte_sha256) {
      record.state = 'REJECTED'; await this.state.storage.put('record', record);
      throw new PdfUploadBoundaryError('UPLOAD_HASH_MISMATCH', 'Expected SHA-256 differs.');
    }
    record.state = 'FINALIZED'; await this.state.storage.put('record', record); return { state: record.state, byte_sha256: record.byte_sha256 };
  }

  async beginAudit({ capability, now = Date.now() }) {
    const record = await this._record(now); authorize(record, requireSecret(this.env), 'audit', capability, now, true);
    if (record.state !== 'FINALIZED') throw new PdfUploadBoundaryError('STATE_TRANSITION_REJECTED', 'Audit requires FINALIZED.');
    record.state = 'AUDITING'; await this.state.storage.put('record', record);
    return { object_key: record.object_key, byte_length: record.byte_length, byte_sha256: record.byte_sha256, r2_version: record.r2_version, r2_etag: record.r2_etag };
  }

  async consumeAudit() {
    const record = await this._record();
    if (record.state !== 'AUDITING') throw new PdfUploadBoundaryError('STATE_TRANSITION_REJECTED', 'Audit completion requires AUDITING.');
    record.state = 'CONSUMED'; await this.state.storage.put('record', record); return { state: record.state };
  }

  async fail(code = 'AUDIT_FAILED') {
    const record = await this._record();
    if (!TERMINAL.has(record.state)) { record.state = 'FAILED'; record.failure_code = code; await this.state.storage.put('record', record); }
    return { state: record.state };
  }

  async delete({ capability, now = Date.now() }) {
    const record = await this._record(now); authorize(record, requireSecret(this.env), 'delete', capability, now, false);
    record.state = 'DELETED'; Object.entries(record.capabilities).forEach(([scope, item]) => { if (scope !== 'delete') item.revoked = true; });
    await this.state.storage.put('record', record); await this.state.storage.deleteAlarm();
    return { state: record.state, object_key: record.object_key };
  }

  async alarm() {
    const record = await this._record(Date.now());
    if (record.state === 'EXPIRED' && this.env.PDF_UPLOADS?.delete) {
      await this.env.PDF_UPLOADS.delete(record.object_key);
      record.r2_deleted_at = Date.now();
      await this.state.storage.put('record', record);
    }
    return { state: record.state, object_key: record.object_key };
  }
}

/** Private R2 adapter. The caller never supplies a bucket, object key, or URL. */
export function createPrivateR2UploadAdapter({ bucket, namespace, maxBytes = 20 * 1024 * 1024, ttlSeconds = 300 }) {
  if (!bucket || !namespace) throw new PdfUploadBoundaryError('UPLOAD_BINDING_MISSING', 'Private R2 and Durable Object bindings are required.');
  const stubFor = (uploadId) => namespace.get(namespace.idFromString(uploadId));
  return {
    async create() {
      const id = namespace.newUniqueId(); const uploadId = id.toString(); const stub = namespace.get(id);
      const created = await stub.createSession({ uploadId, maxBytes, ttlSeconds });
      return {
        upload_id: uploadId,
        upload_url: `/pdf-uploads/${uploadId}#upload_capability=${created.capabilities.upload}`,
        finalize_capability: created.capabilities.finalize,
        audit_capability: created.capabilities.audit,
        delete_capability: created.capabilities.delete,
        expires_at: created.expires_at,
        max_bytes: maxBytes,
      };
    },
    async put({ uploadId, capability, body, declaredLength, queryCapabilityPresent = false }) {
      if (queryCapabilityPresent) throw new PdfUploadBoundaryError('CAPABILITY_QUERY_REJECTED', 'Capabilities are forbidden in query parameters.');
      const stub = stubFor(uploadId); const begun = await stub.beginUpload({ capability, declaredLength });
      let object;
      try {
        object = await bucket.put(begun.object_key, body, { httpMetadata: { contentType: 'application/pdf' } });
      } catch {
        await stub.fail('R2_PUT_FAILED');
        throw new PdfUploadBoundaryError('R2_PUT_FAILED', 'Private object upload failed.');
      }
      if (!object) { await stub.fail('R2_PUT_FAILED'); throw new PdfUploadBoundaryError('R2_PUT_FAILED', 'Private object upload failed.'); }
      if (object.size !== declaredLength || object.size > begun.max_bytes) {
        await bucket.delete(begun.object_key); await stub.fail('R2_LENGTH_DIVERGED');
        throw new PdfUploadBoundaryError('R2_LENGTH_DIVERGED', 'Stored object length differs from the declared length.');
      }
      const completed = await stub.completeUpload({ r2Version: object.version, r2Etag: object.etag, byteLength: object.size });
      return { ...completed, r2_version: object.version, r2_etag: object.etag };
    },
    async recordInspection({ uploadId, byteSha256, r2Version, r2Etag }) {
      return stubFor(uploadId).recordInspection({ byteSha256, r2Version, r2Etag });
    },
    async finalize({ uploadId, capability, expectedSha256 }) {
      return stubFor(uploadId).finalize({ capability, expectedSha256 });
    },
    async readForAudit({ uploadId, capability }) {
      const stub = stubFor(uploadId); const expected = await stub.beginAudit({ capability });
      let object;
      try { object = await bucket.get(expected.object_key); } catch {
        await stub.fail('R2_READ_FAILED');
        throw new PdfUploadBoundaryError('R2_READ_FAILED', 'Private object could not be read.');
      }
      if (!object) { await stub.fail('R2_OBJECT_MISSING'); throw new PdfUploadBoundaryError('R2_OBJECT_MISSING', 'Private object is missing.'); }
      if (object.version !== expected.r2_version || object.etag !== expected.r2_etag || object.size !== expected.byte_length) {
        await stub.fail('R2_OBJECT_DIVERGED'); throw new PdfUploadBoundaryError('R2_OBJECT_DIVERGED', 'Private object metadata diverged.');
      }
      let bytes;
      try {
        bytes = new Uint8Array(await object.arrayBuffer());
      } catch {
        await stub.fail('R2_READ_FAILED');
        throw new PdfUploadBoundaryError('R2_READ_FAILED', 'Private object could not be read.');
      }
      const byteSha256 = createHash('sha256').update(bytes).digest('hex');
      if (bytes.byteLength !== expected.byte_length || byteSha256 !== expected.byte_sha256) {
        await stub.fail('R2_OBJECT_DIVERGED');
        throw new PdfUploadBoundaryError('R2_OBJECT_DIVERGED', 'Private object bytes diverged.');
      }
      return { ...expected, bytes };
    },
    async completeAudit({ uploadId }) { return stubFor(uploadId).consumeAudit(); },
    async fail({ uploadId, code }) { return stubFor(uploadId).fail(code); },
    async delete({ uploadId, capability }) {
      const stub = stubFor(uploadId); const result = await stub.delete({ capability }); await bucket.delete(result.object_key);
      return { upload_id: uploadId, deleted: true, verified_absent: (await bucket.head(result.object_key)) === null };
    },
  };
}
