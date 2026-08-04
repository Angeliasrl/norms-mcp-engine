import { spawn } from 'node:child_process';
import { once } from 'node:events';

const baseUrl = 'http://127.0.0.1:8787';
const wrangler = spawn(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', '8787'],
  { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } },
);

let diagnostics = '';
wrangler.stdout.on('data', (chunk) => { diagnostics += chunk; });
wrangler.stderr.on('data', (chunk) => { diagnostics += chunk; });

async function waitUntilReady() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (wrangler.exitCode !== null) throw new Error(`Wrangler exited early.\n${diagnostics}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Wrangler did not become ready.\n${diagnostics}`);
}

async function runNodeTest(file) {
  const child = spawn(process.execPath, [file], {
    stdio: 'inherit',
    env: { ...process.env, MCP_BASE_URL: baseUrl },
  });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`${file} failed with exit code ${code}`);
}

try {
  await waitUntilReady();
  await runNodeTest('test/mcp-server-transport.mjs');
  await runNodeTest('test/mcp-public-input-contract.mjs');
  await runNodeTest('test/mcp-submission-cases.mjs');
  await runNodeTest('test/cloudflare-runtime-parity.mjs');
  await runNodeTest('test/public-pages-worker.mjs');
  console.log('Cloudflare Workers local gate: PASS');
} finally {
  if (wrangler.exitCode === null) {
    wrangler.kill();
    await Promise.race([once(wrangler, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
}
