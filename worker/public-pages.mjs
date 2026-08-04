const EFFECTIVE_DATE = '4 August 2026';

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const layout = (title, content) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — NORMS</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.55; }
    body { max-width: 52rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    header, footer { border-color: #8888; border-style: solid; border-width: 0 0 1px; }
    footer { border-width: 1px 0 0; margin-top: 3rem; padding-top: 1rem; }
    nav a { margin-right: 1rem; }
    code { overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <header>
    <h1>NORMS</h1>
    <p>Structured Normative Assessment</p>
    <nav><a href="/">Website</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></nav>
  </header>
  <main>${content}</main>
  <footer><p>Published by Francesco Riva. Effective ${EFFECTIVE_DATE}.</p></footer>
</body>
</html>`;

const pages = new Map([
  ['/', layout('Structured Normative Assessment', `
    <h2>Deterministic assessment of structured grounds</h2>
    <p>NORMS evaluates whether structured normative records and structured facts may be relied upon for a declared purpose. It reports blockers, unknowns and unexamined areas and fails closed when required grounds are missing or unverified.</p>
    <h2>How it works</h2>
    <p>The single read-only tool, <code>assess_normative_reliance</code>, evaluates explicitly supplied authority, scope, temporal applicability, verification and structured conditions. Typical uses include checking a fully structured record, evaluating a declared date against an explicit interval, and identifying missing evidence.</p>
    <h2>Outputs</h2>
    <p>Results include admissibility and eligibility fields together with explicit <code>blocking</code>, <code>unknown</code> and <code>unexamined</code> values. An empty blocker list alone is never treated as authorization.</p>
    <h2>Limits</h2>
    <p>NORMS accepts only structured records and facts. It does not accept files or PDFs, retrieve laws from the Internet, infer normative conditions from free text, provide legal advice, certify overall compliance, or modify external data or systems.</p>
  `)],
  ['/privacy', layout('Privacy Policy', `
    <h2>Privacy Policy</h2>
    <p>NORMS may receive structured normative records, structured facts, a declared purpose, an evaluation date and structured external evaluations supplied by the user. These data are used only to calculate and return the requested assessment.</p>
    <p>Do not submit passwords, tokens, payment-card numbers, health data, government identifiers, complete documents or personal data that are not necessary for the assessment.</p>
    <h2>Storage and use</h2>
    <p>NORMS has no database, user memory or intentional application-level retention. The publisher does not use inputs for profiling or training and configures no external telemetry. The application does not intentionally log inputs or outputs.</p>
    <h2>Infrastructure</h2>
    <p>Cloudflare Workers provides processing on Cloudflare's global edge network. Sampled infrastructure logs are enabled at a 0.01 sampling rate and may be retained for 7 days under the active plan. Cloudflare is the infrastructure provider. No additional application-level subprocessors are configured.</p>
    <h2>Your choices and contact</h2>
    <p>You can avoid processing by not using the service and should minimize all inputs. Questions or requests concerning data that may appear in infrastructure logs can be sent to <a href="mailto:privacy@beforebabel.org">privacy@beforebabel.org</a>, subject to applicable technical and legal limits. This policy does not describe processing independently performed by OpenAI or other client providers.</p>
  `)],
  ['/terms', layout('Terms of Service', `
    <h2>Terms of Service</h2>
    <p>NORMS is a read-only informational tool for bounded assessment of structured normative records and facts. It does not provide legal advice or certify legal or regulatory compliance.</p>
    <p>You are responsible for the accuracy, authority and lawful use of your inputs. Do not submit secrets, prohibited data or unnecessary personal information. Do not misuse, disrupt, overload or attempt offensive reverse engineering of the service.</p>
    <p>Availability is not guaranteed. The service may be suspended, limited or modified. Software and content remain subject to their applicable intellectual-property rights and open-source licences.</p>
    <p>To the extent permitted by applicable law, the service is provided without warranties and the publisher is not liable for decisions made in reliance on its output or for indirect or consequential loss. Nothing in these terms limits mandatory rights or liability that cannot lawfully be excluded.</p>
    <p>These terms are governed by Italian law, without creating an exclusive choice of forum or displacing mandatory protections that may apply to users. Questions may be sent to <a href="mailto:support@beforebabel.org">support@beforebabel.org</a>.</p>
  `)],
  ['/support', layout('Support', `
    <h2>Support</h2>
    <p>For technical problems, availability questions, documentation questions or security reports, contact <a href="mailto:support@beforebabel.org">support@beforebabel.org</a>. Privacy requests should be sent separately to <a href="mailto:privacy@beforebabel.org">privacy@beforebabel.org</a>.</p>
    <p>Include a concise problem description, approximate time, endpoint and sanitized error text. Do not email structured normative records, personal information, credentials, tokens or other secrets unless strictly necessary and expressly requested through a suitable channel.</p>
    <p>No response-time service level is promised. Reports are reviewed as reasonably practicable. For security reports, describe reproducible impact without exploiting or disrupting the service.</p>
  `)],
]);

const securityHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=() ',
  'cache-control': 'public, max-age=300',
};

export function publicPageResponse(pathname, method, env) {
  if (pathname === '/.well-known/openai-apps-challenge') {
    if (method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    const token = env?.OPENAI_APPS_CHALLENGE;
    if (typeof token !== 'string' || token.length === 0) return new Response('Not Found', { status: 404 });
    return new Response(token, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  }

  const page = pages.get(pathname);
  if (page === undefined) return null;
  if (method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: securityHeaders });
  return new Response(page, { headers: securityHeaders });
}
