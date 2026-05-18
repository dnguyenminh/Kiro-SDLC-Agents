/**
 * ExecuteDynamicTool — execute tool with fallback chain support.
 * Behavioral parity with Kotlin ExecuteDynamicTool.kt.
 */

import { OrchestrationEngine } from '../engine.js';

export async function executeDynamic(engine: OrchestrationEngine, args: Record<string, any>): Promise<string> {
  const toolName = args.tool_name;
  if (!toolName) return JSON.stringify({ error: "Missing 'tool_name'" });
  const arguments_ = args.arguments ?? {};
  const chain = engine.getRegistry().getChain(toolName);
  if (chain) return executeChain(engine, chain, arguments_);
  return executeSingle(engine, toolName, arguments_);
}

async function executeChain(engine: OrchestrationEngine, chain: any, args: Record<string, any>): Promise<string> {
  const errors: string[] = [];
  for (const entry of chain.entries) {
    const actualName = entry.toolName ?? chain.toolName;
    try {
      const result = await engine.callChild(entry.serverName, actualName, args);
      engine.getRegistry().recordHit(chain.toolName);
      return result;
    } catch (e: any) {
      errors.push(`${entry.serverName}: ${e.message}`);
    }
  }
  return JSON.stringify({ error: `Tool '${chain.toolName}' failed on all ${chain.entries.length} servers: [${errors.join(', ')}]` });
}

async function executeSingle(engine: OrchestrationEngine, toolName: string, args: Record<string, any>): Promise<string> {
  try {
    const result = await engine.route(toolName, args);
    engine.getRegistry().recordHit(toolName);
    return result;
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}
