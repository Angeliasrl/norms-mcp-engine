# OpenAI domain verification operations 01

Canonical domain: `norms.beforebabel.org`

The Worker reserves `GET /.well-known/openai-apps-challenge`. When the `OPENAI_APPS_CHALLENGE` Worker secret is absent or empty, the route returns HTTP 404 without a redirect. No placeholder token is committed.

When OpenAI provides the exact challenge value:

1. set it as a Cloudflare Worker secret named `OPENAI_APPS_CHALLENGE` using the authenticated administrative workflow;
2. deploy without adding the value to `wrangler.jsonc`, source files, logs or repository history;
3. verify HTTP 200, `text/plain; charset=utf-8`, no redirect and a response body exactly equal to the provided value;
4. do not intentionally log the value;
5. remove or rotate the secret when the publisher determines it is no longer required.

The publisher must obtain the value from the OpenAI portal in a later authorized phase. This document does not assert that domain verification has occurred.
