/**
 * ExecuteDynamicTool — execute tool with mapping check + fallback chain support.
 * KSA-66: Routes via bridge's execute_dynamic_tool for nested tools (mapping check first).
 * KSA-139: Post-execution hooks for KB cache population/invalidation.
 * Behavioral parity with Python execute_dynamic.py.
 */

import { OrchestrationEngine } from '../engine.js';
import { CacheSource } from '../cache/index.js';

/** Execute a tool by name — mapping → chain → single routing. */
export async function executeDynamic(engine: OrchestrationEngine, args: Record<string, any>): Promise<string> {
  const toolName = args.tool_name;
  if (!toolName) return JSON.stringify({ error: "Missing 'tool_name'" });
  const toolArgs = args.arguments ?? {};
  const agentName = args.agent_name ?? 'default';

  const mapping = engine.getToolMapping(toolName);
  if (mapping) return executeViaBridgeWithCache(engine, toolName, mapping, toolArgs, agentName);

  const chain = engine.getRegistry().getChain(toolName);
  if (chain) return executeChainWithCache(engine, chain, toolArgs, agentName);

  return executeSingleWithCache(engine, toolName, toolArgs, agentName);
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

/** Execute via bridge with KB cache hooks (KSA-139). */
async function executeViaBridgeWithCache(
  engine: OrchestrationEngine, toolName: string, mapping: [string, string],
  args: Record<string, any>, agentName: string
): Promise<string> {
  const result = await executeViaBridge(engine, toolName, mapping, args);
  if (!isErrorResult(result)) {
    fireCacheWrite(engine, toolName, mapping[0], agentName);
  } else {
    fireCacheInvalidate(engine, toolName, agentName, result);
  }
  return result;
}

/** Execute chain with KB cache hooks (KSA-139). */
async function executeChainWithCache(
  engine: OrchestrationEngine, chain: any, args: Record<string, any>, agentName: string
): Promise<string> {
  const result = await executeChain(engine, chain, args);
  const toolName = chain.toolName;
  if (!isErrorResult(result)) {
    const serverName = chain.entries?.[0]?.serverName ?? 'unknown';
    fireCacheWrite(engine, toolName, serverName, agentName);
  } else {
    fireCacheInvalidate(engine, toolName, agentName, result);
  }
  return result;
}

/** Execute single with KB cache hooks (KSA-139). */
async function executeSingleWithCache(
  engine: OrchestrationEngine, toolName: string, args: Record<string, any>, agentName: string
): Promise<string> {
  const result = await executeSingle(engine, toolName, args);
  if (!isErrorResult(result)) {
    const tool = engine.getRegistry().find(toolName);
    const serverName = tool?.source ?? 'unknown';
    fireCacheWrite(engine, toolName, serverName, agentName);
  } else {
    fireCacheInvalidate(engine, toolName, agentName, result);
  }
  return result;
}

/** Fire-and-forget: write to KB cache on success (KSA-139). */
function fireCacheWrite(engine: OrchestrationEngine, toolName: string, serverName: string, agentName: string): void {
  try {
    const writer = engine.getKbCacheWriter();
    const tool = engine.getRegistry().find(toolName);
    const description = tool?.definition?.description ?? '';
    const inputSchema = tool?.definition?.inputSchema ?? {};
    // Determine source — for now treat as DISCOVERED (first use populates cache)
    writer.onSuccess(toolName, serverName, description, inputSchema, agentName, CacheSource.DISCOVERED)
      .catch((e: any) => console.error(`[kb-cache] Write error: ${e.message}`));
  } catch {
    // Non-blocking — never fail execution due to cache
  }
}

/** Fire-and-forget: invalidate KB cache on failure (KSA-139). */
function fireCacheInvalidate(engine: OrchestrationEngine, toolName: string, agentName: string, errorResult: string): void {
  try {
    const invalidator = engine.getKbCacheInvalidator();
    invalidator.onFailure(toolName, agentName, errorResult)
      .catch((e: any) => console.error(`[kb-cache] Invalidate error: ${e.message}`));
  } catch {
    // Non-blocking
  }
}
