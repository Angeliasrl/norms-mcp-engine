import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { startNormsMcpServer } from '../server/index.mjs';

export async function withMcpClient(run) {
  const running = await startNormsMcpServer({ port: 0 });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://${running.host}:${running.port}/mcp`),
  );
  const client = new Client({ name: 'norms-mcp-test-client', version: '0.1.0' });
  try {
    await client.connect(transport);
    return await run({ client, running });
  } finally {
    await transport.close().catch(() => {});
    await running.close();
  }
}

export const toolArgumentsFromFixture = (fixture) => ({
  entry: structuredClone(fixture.entry),
  context: structuredClone(fixture.context),
  reliance_purpose: 'CURRENT_OPERATIONAL',
  as_of: fixture.evaluation_date,
  trusted_external_evaluations: structuredClone(fixture.trust.trusted_external_evaluations),
});

export async function callAssessment(client, args) {
  return client.callTool({ name: 'assess_normative_reliance', arguments: args });
}
