/**
 * norms-mcp — corpus canonicalisation and digest.
 *
 * Implements README §Canonicalisation.
 *
 * Two properties matter and both have bitten real systems:
 *
 *  1. Lengths are UTF-8 BYTE counts. `String.prototype.length` returns UTF-16
 *     code units, so a single character outside the BMP makes two conforming
 *     implementations disagree on the digest.
 *
 *  2. Framing, not concatenation. Two different corpora can concatenate to the
 *     same byte stream. `test/canonical.test.mjs` demonstrates the collision
 *     and shows framing removing it.
 */

import { createHash } from 'node:crypto';

const enc = new TextEncoder();

/** UTF-8 byte length. Never use s.length here. */
export const byteLength = (s) => enc.encode(s).length;

/**
 * Per-document canonical form:
 *   UTF-8, no BOM, LF line endings, trailing whitespace stripped, Unicode NFC.
 */
export function canonicaliseContent(text) {
  let s = String(text);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM
  s = s.normalize('NFC');
  s = s.replace(/\r\n?/g, '\n'); // CRLF and lone CR → LF
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
  return s;
}

/** Length prefix: 8-byte unsigned big-endian. Fixed width and endianness are
 *  part of the specification — without them two implementations can differ. */
function prefix(n) {
  const b = new Uint8Array(8);
  let v = BigInt(n);
  for (let i = 7; i >= 0; i--) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
}

function concatBytes(chunks) {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/**
 * Canonical byte stream over the corpus:
 *
 *   for each document, in id order:
 *     len(id) || id || len(content) || content
 *
 * `documents` is a map of id → raw text, or an array of {id, content}.
 */
export class CorpusError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CorpusError';
    this.code = code;
  }
}

/**
 * Single admission gate for the corpus. canonicalBytes and buildIndex both go
 * through it, so the digest and the index can never disagree about which
 * documents are admissible — a divergence there would make revalidation
 * silently wrong.
 */
export function normaliseDocuments(documents) {
  let list;
  if (Array.isArray(documents)) {
    list = documents.map((d) => {
      if (d === null || typeof d !== 'object') {
        throw new CorpusError('each document must be an object with id and content', 'DOC_MALFORMED');
      }
      return [d.id, d.content];
    });
  } else if (documents !== null && typeof documents === 'object') {
    // Reflect.ownKeys, not Object.entries: a caller passing a Map or an object
    // built with Object.create(null) must behave identically, and own
    // non-enumerable keys must not be silently dropped from the corpus.
    list = documents instanceof Map
      ? [...documents.entries()]
      : Reflect.ownKeys(documents)
          .filter((k) => typeof k === 'string')
          .map((k) => [k, documents[k]]);
  } else {
    throw new CorpusError('documents must be an array or an object', 'CORPUS_MALFORMED');
  }

  const seen = new Set();
  for (const [id, content] of list) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new CorpusError('document id must be a non-empty string', 'DOC_ID_EMPTY');
    }
    if (typeof content !== 'string') {
      throw new CorpusError(`document ${id}: content must be a string`, 'DOC_CONTENT_MALFORMED');
    }
    if (seen.has(id)) {
      throw new CorpusError(`duplicate document id: ${id}`, 'DOC_ID_DUPLICATE');
    }
    seen.add(id);
  }
  return list;
}

export function canonicalBytes(documents) {
  const list = normaliseDocuments(documents);

  // Sort by the UTF-8 bytes of the id, not by locale-dependent string order.
  list.sort(([a], [b]) => {
    const A = enc.encode(a);
    const B = enc.encode(b);
    const n = Math.min(A.length, B.length);
    for (let i = 0; i < n; i++) if (A[i] !== B[i]) return A[i] - B[i];
    return A.length - B.length;
  });

  const chunks = [];
  for (const [id, raw] of list) {
    const content = canonicaliseContent(raw);
    const idBytes = enc.encode(id);
    const contentBytes = enc.encode(content);
    chunks.push(prefix(idBytes.length), idBytes, prefix(contentBytes.length), contentBytes);
  }
  return concatBytes(chunks);
}

/** The corpus digest. Stable across seedings: depends only on composition and
 *  canonical content, never on seeding time. */
export function corpusDigest(documents) {
  return createHash('sha256').update(canonicalBytes(documents)).digest('hex');
}

/** Per-document digest, over the canonical form. */
export function documentDigest(text) {
  return createHash('sha256').update(enc.encode(canonicaliseContent(text))).digest('hex');
}

/** Index: id → {sha256, bytes}. This is what revalidation checks against. */
export function buildIndex(documents) {
  const list = normaliseDocuments(documents);
  // Null prototype: an id such as "__proto__" becomes a real own property
  // instead of mutating the prototype and vanishing from the index.
  const index = Object.create(null);
  for (const [id, raw] of list) {
    const content = canonicaliseContent(raw);
    index[id] = { sha256: documentDigest(raw), bytes: byteLength(content) };
  }
  return index;
}

/**
 * Drift detection. Compares a freshly computed digest against the served one.
 * Returns a non-zero-style verdict the caller can turn into an exit code.
 */
export function detectDrift(localDocuments, servedDigest) {
  if (typeof servedDigest !== 'string' || !/^[0-9a-f]{64}$/.test(servedDigest)) {
    throw new CorpusError('servedDigest must be 64 lowercase hex characters', 'DIGEST_MALFORMED');
  }
  const local = corpusDigest(localDocuments);
  return {
    drift: local !== servedDigest,
    local,
    served: servedDigest,
  };
}
