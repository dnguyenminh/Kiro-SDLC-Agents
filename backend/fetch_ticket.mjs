import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function fetchTicket() {
  const transport = new SSEClientTransport(new URL('http://localhost:3061/sse'));
  const client = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });
  await client.connect(transport);
  const result = await client.callTool({
    name: 'jira_get_issue',
    arguments: { issue_key: 'KSA-293' }
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
fetchTicket().catch(console.error);
