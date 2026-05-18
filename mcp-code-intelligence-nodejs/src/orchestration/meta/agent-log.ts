/**
 * agent_log meta-tool — logs agent activity to .code-intel/agent-log.jsonl.
 */

import * as fs from 'fs';
import * as path from 'path';

export const AGENT_LOG_DEFINITION = {
  name: 'agent_log',
  description: 'Write an execution log entry for agent activity tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      ticket_key: { type: 'string', description: 'Jira ticket key (e.g. MTO-12)' },
      agent_name: { type: 'string', description: 'Agent: SM, BA, TA, SA, QA, DEV, DEVOPS' },
      step: { type: 'string', description: 'Step ID (e.g. Step-1, Self-Check)' },
      status: { type: 'string', description: 'START|DONE|ARTIFACT|SKIP|ERROR|WARN|VERIFY' },
      message: { type: 'string', description: 'What happened' },
      artifacts: { type: 'string', description: 'Optional JSON of artifact paths' },
    },
    required: ['ticket_key', 'agent_name', 'step', 'status', 'message'],
  },
};

export function executeAgentLog(args: Record<string, any>, workspace: string): string {
  const ticketKey = args.ticket_key ?? '';
  const agentName = args.agent_name ?? '';
  const step = args.step ?? '';
  const status = args.status ?? '';
  const message = args.message ?? '';
  const artifacts = args.artifacts;

  if (!ticketKey || !agentName || !status) {
    return JSON.stringify({ error: 'ticket_key, agent_name, status are required' });
  }

  const entry: Record<string, any> = {
    timestamp: new Date().toISOString(),
    ticket_key: ticketKey,
    agent_name: agentName,
    step,
    status,
    message,
  };
  if (artifacts) entry.artifacts = artifacts;

  const logDir = path.join(workspace, '.code-intel');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(path.join(logDir, 'agent-log.jsonl'), JSON.stringify(entry) + '\n');

  return JSON.stringify({ success: true, logged: `${ticketKey}/${agentName}/${step}/${status}` });
}
