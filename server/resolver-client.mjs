export const RESOLVER_TIMEOUT_MS = 30_000;
export const RESOLVER_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class ResolverError extends Error {
  constructor(code, message) { super(message); this.name = 'ResolverError'; this.code = code; }
}

async function boundedJson(response) {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > RESOLVER_MAX_RESPONSE_BYTES) throw new ResolverError('RESOLVER_RESPONSE_TOO_LARGE', 'Resolver response exceeds limit.');
  if (!response.body) throw new ResolverError('RESOLVER_RESPONSE_MALFORMED', 'Resolver response body missing.');
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength; if (total > RESOLVER_MAX_RESPONSE_BYTES) { await reader.cancel(); throw new ResolverError('RESOLVER_RESPONSE_TOO_LARGE', 'Resolver response exceeds limit.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ResolverError('RESOLVER_RESPONSE_MALFORMED', 'Resolver returned invalid JSON.'); }
}

export function createResolverClient({ binding, localBaseUrl, fetchImpl = fetch, timeoutMs = RESOLVER_TIMEOUT_MS } = {}) {
  if (!binding && localBaseUrl && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(localBaseUrl)) throw new ResolverError('RESOLVER_LOCAL_URL_REJECTED', 'Only loopback development endpoints are accepted.');
  return {
    async resolve(request) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const target = binding
          ? (typeof binding.getByName === 'function' ? binding.getByName('norms-resolver-v1') : binding)
          : { fetch: (req) => fetchImpl(req) };
        if (typeof target.fetch !== 'function') throw new ResolverError('RESOLVER_BINDING_INVALID', 'Resolver binding does not expose fetch.');
        const url = binding ? 'http://resolver.internal/resolve' : `${localBaseUrl}/resolve`;
        const response = await target.fetch(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal }));
        const body = await boundedJson(response);
        if (!response.ok) throw new ResolverError(body?.error?.code ?? 'RESOLVER_UNAVAILABLE', 'Resolver rejected the request.');
        return body;
      } catch (error) {
        if (error instanceof ResolverError) throw error;
        if (error?.name === 'AbortError') throw new ResolverError('RESOLVER_TIMEOUT', 'Resolver timed out.');
        throw new ResolverError('RESOLVER_UNAVAILABLE', 'Resolver is unavailable.');
      } finally { clearTimeout(timer); }
    },
  };
}

export function resolverClientFromEnv(env = {}) {
  if (env.NORMS_RESOLVER) return createResolverClient({ binding: env.NORMS_RESOLVER });
  if (env.ENVIRONMENT === 'development' && env.NORMS_RESOLVER_LOCAL_URL) return createResolverClient({ localBaseUrl: env.NORMS_RESOLVER_LOCAL_URL });
  return { resolve: async () => { throw new ResolverError('RESOLVER_NOT_CONFIGURED', 'Resolver binding is not configured.'); } };
}
