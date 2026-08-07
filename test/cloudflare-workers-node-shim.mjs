import { register } from 'node:module';

register('./cloudflare-workers-node-loader.mjs', import.meta.url);
