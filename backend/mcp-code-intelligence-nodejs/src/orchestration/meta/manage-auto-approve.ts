/**
 * manage_auto_approve meta-tool — add/remove tools from auto-approve list.
 * Persists to .code-intel/auto-approve.json.
 */

import * as fs from 'fs';
import * as path from 'path';

export const MANAGE_AUTO_APPROVE_DEFINITION = {
  name: 'manage_auto_approve',
  description: 'Add or remove tools from the auto-approve list (persists across restarts).',
  inputSchema: {
    type: 'object',
    properties: {
      tool_name: { type: 'string', description: 'Name of the tool to update' },
      server_name: { type: 'string', description: 'Name of the server (if updating all tools of a server)' },
      auto_approve: { type: 'boolean', description: 'Whether to add or remove from auto-approve list' },
    },
    required: ['auto_approve'],
  },
};

export function executeManageAutoApprove(args: Record<string, any>, workspace: string): string {
  const autoApprove = args.auto_approve;
  if (typeof autoApprove !== 'boolean') {
    return JSON.stringify({ error: "Missing 'auto_approve' (boolean)" });
  }
  const toolName = args.tool_name as string | undefined;
  const serverName = args.server_name as string | undefined;
  if (!toolName && !serverName) {
    return JSON.stringify({ error: "Provide 'tool_name' or 'server_name'" });
  }
  const target = toolName ?? `server:${serverName}`;
  const list = loadList(workspace);
  if (autoApprove) {
    list.add(target);
  } else {
    list.delete(target);
  }
  saveList(workspace, list);
  const action = autoApprove ? 'added to' : 'removed from';
  return JSON.stringify({ success: true, message: `'${target}' ${action} auto-approve list` });
}

function getFilePath(workspace: string): string {
  const dir = path.join(workspace, '.code-intel');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'auto-approve.json');
}

function loadList(workspace: string): Set<string> {
  const filePath = getFilePath(workspace);
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const arr = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveList(workspace: string, list: Set<string>): void {
  const filePath = getFilePath(workspace);
  fs.writeFileSync(filePath, JSON.stringify([...list]), 'utf-8');
}
