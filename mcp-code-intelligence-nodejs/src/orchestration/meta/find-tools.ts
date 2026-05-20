/**
 * FindToolsTool — semantic search across all registered tools + KB + nested delegates.
 * KSA-66: Nested delegation — delegates to child orchestrators for lazy discovery.
 * Behavioral parity with Python find_tools.py.
 */

import { OrchestrationEngine } from '../engine.js';
import { RegisteredTool } from '../registry/grouper.js';

/** Execute tokenized search for tools matching query. */
export function executeFindTools(engine: OrchestrationEngine, args: Record<string, any>): string {
  const query = args.query;
  if (!query) return JSON.stringify({ error: "Missing 'query'" });

  const registryResults = engine.getRegistry().search(query);
  const nestedResults = delegateToNested(engine, query);
  const merged = mergeResults(registryResults, nestedResults);

  if (merged.length > 0) {
    return JSON.stringify(merged.slice(0, 10).map((t) => t.definition));
  }

  const kbResults = searchKb(engine, query);
  if (kbResults.length > 0) {
    return JSON.stringify(kbResults.slice(0, 10).map((t) => t.definition));
  }

  return '[]';
}

/** Delegate find_tools to nested orchestrators and cache results. */
async function delegateToNestedAsync(engine: OrchestrationEngine, query: string): Promise<Record<string, any>[]> {
  const delegates = engine.getFindToolsDelegates();
  if (delegates.length === 0) return [];
  console.error(`[find_tools] Delegating to [${delegates.join(', ')}]`);
  const allResults: Record<string, any>[] = [];

  for (const serverName of delegates) {
    try {
      const raw = await engine.callChild(serverName, 'find_tools', { query });
      const tools = parseToolList(raw);
      console.error(`[find_tools] Nested on ${serverName} returned ${tools.length} tools`);
      for (const toolDef of tools) {
        const originalName = toolDef.name ?? '';
        if (!originalName) continue;
        const uniqueName = `${serverName}::${originalName}`;
        engine.registerNestedTool(uniqueName, serverName, originalName, toolDef);
        allResults.push(toolDef);
      }
    } catch (e: any) {
      console.error(`[find_tools] Nested failed on ${serverName}: ${e.message}`);
    }
  }
  return allResults;
}

/** Sync wrapper — runs nested delegation (blocks via top-level await pattern). */
function delegateToNested(engine: OrchestrationEngine, query: string): Record<string, any>[] {
  const delegates = engine.getFindToolsDelegates();
  if (delegates.length === 0) return [];
  // Use synchronous approach: schedule and return empty for now,
  // results will be available on next call (lazy caching pattern)
  delegateToNestedAsync(engine, query).catch((e) =>
    console.error(`[find_tools] Background delegation error: ${e.message}`)
  );
  return [];
}

/** Async version of executeFindTools for use in async contexts. */
export async function executeFindToolsAsync(engine: OrchestrationEngine, args: Record<string, any>): Promise<string> {
  const query = args.query;
  if (!query) return JSON.stringify({ error: "Missing 'query'" });

  const registryResults = engine.getRegistry().search(query);
  const nestedResults = await delegateToNestedAsync(engine, query);
  const merged = mergeResults(registryResults, nestedResults);

  if (merged.length > 0) {
    return JSON.stringify(merged.slice(0, 10).map((t) => t.definition));
  }

  const kbResults = searchKb(engine, query);
  if (kbResults.length > 0) {
    return JSON.stringify(kbResults.slice(0, 10).map((t) => t.definition));
  }

  return '[]';
}

/** Parse raw JSON response into list of tool definitions. */
function parseToolList(raw: string): Record<string, any>[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.tools)) return parsed.tools;
    if (parsed && typeof parsed === 'object') return [parsed];
    return [];
  } catch {
    return [];
  }
}

/** Search KB for tool definitions (best-effort). */
function searchKb(engine: OrchestrationEngine, query: string): RegisteredTool[] {
  const mem = engine.getMemoryEngine();
  if (!mem) return [];
  try {
    const results = mem.search?.search(query, { limit: 20 }) ?? [];
    return resolveKbResults(engine, results);
  } catch {
    return [];
  }
}

/** Parse KB results → extract tool names → lookup in registry. */
function resolveKbResults(engine: OrchestrationEngine, results: any[]): RegisteredTool[] {
  const resolved: RegisteredTool[] = [];
  for (const result of results) {
    const content = typeof result === 'string' ? result : (result?.content ?? String(result));
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const toolName = trimmed.split(' [')[0]?.trim();
      if (!toolName) continue;
      const tool = engine.getRegistry().find(toolName);
      if (tool) resolved.push(tool);
    }
  }
  return resolved;
}

/** Merge registry + nested results, deduplicate by tool name. */
function mergeResults(registry: RegisteredTool[], nested: Record<string, any>[]): RegisteredTool[] {
  const seen = new Set(registry.map((t) => t.definition.name ?? t.name));
  const merged = [...registry];
  for (const toolDef of nested) {
    const name = toolDef.name ?? '';
    if (name && !seen.has(name)) {
      seen.add(name);
      merged.push({ name, definition: toolDef, source: 'nested', priority: 0, nameTokens: new Set(), descTokens: new Set() });
    }
  }
  return merged;
}
