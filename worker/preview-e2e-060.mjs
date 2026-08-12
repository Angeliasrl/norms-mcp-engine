// PREVIEW E2E 0.6.0 (round §8.1) — entry ISOLATO, mai usato dalla produzione.
// worker/index.mjs (produzione) resta intatto: questo file lo importa e lo estende.
// Da eliminare insieme alla preview dopo la cattura dell'evidenza.
import productionWorker, { NormsResolverContainer } from './index.mjs';

export { ContainerProxy, PdfUploadDurableObject } from './index.mjs';

const RESOLVER_PREVIEW_HOST = 'norms-resolver-v1-e2e-preview.friva1947.workers.dev';

export class NormsResolverContainerPreview extends NormsResolverContainer {
  constructor(ctx, env) {
    super(ctx, env);
    // Terza gamba della preview: il container raggiunge SOLO il resolver isolato
    // della preview. Eccezione egress dichiarata: un host esatto in più rispetto
    // all'allowlist ufficiale (che resta invariata); l'instradamento reale passa
    // dal service binding qui sotto, mai da produzione.
    this.allowedHosts = [...(this.allowedHosts ?? []), RESOLVER_PREVIEW_HOST];
    this.envVars = { ...this.envVars, NORMS_RESOLVER_URL: `https://${RESOLVER_PREVIEW_HOST}` };
  }
}

// Il fetch worker→worker via URL workers.dev dello stesso account è bloccato
// (errore 1042): l'egress intercettato verso il resolver preview viaggia sul
// service binding dedicato.
NormsResolverContainerPreview.outboundByHost = {
  [RESOLVER_PREVIEW_HOST]: (request, env) => env.RESOLVER_PREVIEW.fetch(request),
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/resolve' && request.method === 'POST' && env.ENVIRONMENT === 'preview') {
      // Passthrough di smoke/matrice §6b: inoltra la request al service nel
      // container, byte-invariata. Esiste solo su questo entry di preview.
      const target = env.NORMS_RESOLVER.getByName('norms-resolver-v1');
      return target.fetch(new Request('http://resolver.internal/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: request.body,
      }));
    }
    return productionWorker.fetch(request, env, ctx);
  },
};
