/**
 * ExecuteDynamicTool — execute tool with mapping check + fallback chain support.
 * KSA-66: Routes via bridge's execute_dynamic_tool for nested tools (mapping check first).
 * Behavioral parity with Python execute_dynamic.py.
 */

import { OrchestrationEngine } from '../engine.js';

/** Execute a tool by name — mapping → chain → single routing. */
export async function executeDynamic(engine: OrchestrationEngine, args: Record<string, any>): Promise<string> {
  const toolName = args.tool_name;
  if (!toolName) return JSON.stringify({ error: "Missing 'tool_name'" });
  const toolArgs = args.arguments ?? {};

  const mapping = engine.getToolMapping(toolName);
  if (mapping) return executeViaBridge(engine, toolName, mapping, toolArgs);

  const chain = engine.getRegistry().getChain(toolName);
  if (chain) return executeChain(engine, chain, toolArgs);

  return executeSingle(engine, toolName, toolArgs);
}

/** Execute via nested server's execute_dynamic_tool (bridge pattern). */
async function executeViaBridge(
  engine: OrchestrationEngine, toolName: string, mapping: [string, string], args: Record<string, any>
): Promise<string> {
  const [serverName, originalName] = mapping;
  const bridgeArgs = { tool_name: originalName, arguments: args };
  try {
    const result = await engine.callChild(serverName, 'execute_dynamic_tool', bridgeArgs);
    engine.getRegistry().recordHit(toolName, 1);
    if (!isErrorResult(result)) engine.getRegistry().recordHit(toolName, 3);
    return result;
  } catch (e: any) {
    return JSON.stringify({ error: `Nested execute failed on ${serverName}: ${e.message}` });
  }
}

/** Execute through fallback chain — try each server in priority order. */
async function executeChain(engine: OrchestrationEngine, chain: any, args: Record<string, any>): Promise<string> {
  const errors: string[] = [];
  for (const entry of chain.entries) {
    const actualName = entry.toolName ?? chain.toolName;
    try {
      const result = await engine.callChild(entry.serverName, actualName, args);
      engine.getRegistry().recordHit(chain.toolName, 1);
      if (!isErrorResult(result)) engine.getRegistry().recordHit(chain.toolName, 3);
      return result;
    } catch (e: any) {
      errors.push(`${entry.serverName}: ${e.message}`);
    }
  }
  return JSON.stringify({ error: `Tool '${chain.toolName}' failed on all ${chain.entries.length} servers: [${errors.join(', ')}]` });
}

/** Execute on single server via normal routing. */
async function executeSingle(engine: OrchestrationEngine, toolName: string, args: Record<string, any>): Promise<string> {
  try {
    const result = await engine.route(toolName, args);
    engine.getRegistry().recordHit(toolName, 1);
    if (!isErrorResult(result)) engine.getRegistry().recordHit(toolName, 3);
    return result;
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

function isErrorResult(result: string): boolean {
  return result.trimStart().startsWith('{"error"') || result.slice(0, 100).includes('"error"');
}
