/**
 * Meta-tool dispatcher — routes meta-tool calls to handlers.
 * Behavioral parity with Kotlin MetaToolDispatcher.kt.
 */

import { OrchestrationEngine } from '../engine.js';
import { executeFindTools } from './find-tools.js';
import { executeDynamic } from './execute-dynamic.js';
import { AGENT_LOG_DEFINITION, executeAgentLog } from './agent-log.js';
import { MANAGE_AUTO_APPROVE_DEFINITION, executeManageAutoApprove } from './manage-auto-approve.js';

export const META_TOOL_DEFINITIONS = [
  {
    name: 'find_tools',
    description: 'Search for available tools by describing what you want to accomplish. Returns tool definitions with input schemas.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Natural language description or keyword to search for' } }, required: ['query'] },
  },
  {
    name: 'execute_dynamic_tool',
    description: 'Execute a tool on an upstream MCP server by exact tool name.',
    inputSchema: { type: 'object', properties: { tool_name: { type: 'string', description: 'Exact tool name to execute' }, arguments: { type: 'object', description: 'Arguments for the tool' } }, required: ['tool_name'] },
  },
  {
    name: 'toggle_tool',
    description: 'Enable or disable a specific tool or an entire server for the current session.',
    inputSchema: { type: 'object', properties: { tool_name: { type: 'string' }, server_name: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['enabled'] },
  },
  {
    name: 'reset_tools',
    description: 'Reset all tool/server toggle states to their default enabled state.',
    inputSchema: { type: 'object', properties: { server_name: { type: 'string' } } },
  },
  MANAGE_AUTO_APPROVE_DEFINITION,
  {
    name: 'orchestration_status',
    description: 'Show orchestration status: servers, tools, metrics.',
    inputSchema: { type: 'object', properties: {} },
  },
  AGENT_LOG_DEFINITION,
];

const META_TOOL_NAMES = new Set(META_TOOL_DEFINITIONS.map((d) => d.name));

export class MetaToolDispatcher {
  constructor(private engine: OrchestrationEngine) {}

  /** Dispatch a meta-tool call. Returns null if not a meta-tool. */
  async dispatch(toolName: string, args: Record<string, any>): Promise<string | null> {
    if (!META_TOOL_NAMES.has(toolName)) return null;
    if (toolName === 'find_tools') return executeFindTools(this.engine, args);
    if (toolName === 'execute_dynamic_tool') return executeDynamic(this.engine, args);
    if (toolName === 'toggle_tool') return this.handleToggle(args);
    if (toolName === 'reset_tools') return this.handleReset();
    if (toolName === 'manage_auto_approve') return executeManageAutoApprove(args, this.engine.getWorkspace());
    if (toolName === 'orchestration_status') return this.handleStatus();
    if (toolName === 'agent_log') return executeAgentLog(args, this.engine.getWorkspace());
    return JSON.stringify({ error: `Meta-tool '${toolName}' not implemented` });
  }

  getDefinitions(): Record<string, any>[] { return META_TOOL_DEFINITIONS; }

  private handleToggle(args: Record<string, any>): string {
    const enabled = args.enabled ?? true;
    const toolName = args.tool_name;
    if (toolName) {
      this.engine.getRegistry().toggle(toolName, enabled);
      return JSON.stringify({ toggled: toolName, enabled });
    }
    return JSON.stringify({ error: 'tool_name or server_name required' });
  }

  private handleReset(): string {
    this.engine.getRegistry().resetToggles();
    return JSON.stringify({ reset: true });
  }

  private handleStatus(): string {
    return JSON.stringify({ orchestration: this.engine.getStatus(), servers: this.engine.getServerStatus() });
  }
}
