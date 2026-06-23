/**
 * KB Cache Models — data structures for 2-level agent tool cache registry.
 * KSA-139: L1 (global) + L2 (per-agent) KB-backed cache entries.
 */

export enum CacheSource {
  L2_CACHE = 'l2_cache',
  L1_CACHE = 'l1_cache',
  DISCOVERED = 'discovered',
}

export interface ToolCacheEntry {
  toolName: string;
  serverName: string;
  description: string;
  inputSchema: Record<string, any>;
  scope: string;       // "global" or "agent:{name}"
  hits: number;
  lastUsed: string;
}

/** Build deterministic KB title for dedup. */
export function cacheTitle(scope: string, toolName: string): string {
  return `tool-cache:${scope}:${toolName}`;
}

/** Build KB tags string for a cache entry. */
export function cacheTags(scope: string, serverName: string): string {
  const base = 'tool-cache';
  if (scope === 'global') {
    return `${base}, scope:global, server:${serverName}`;
  }
  return `${base}, ${scope}, server:${serverName}`;
}

/** Serialize entry to KB content JSON string. */
export function entryToKbContent(entry: ToolCacheEntry): string {
  return JSON.stringify({
    tool_name: entry.toolName,
    server_name: entry.serverName,
    description: entry.description,
    input_schema: entry.inputSchema,
    hits: entry.hits,
    last_used: entry.lastUsed,
  }, null, 2);
}

/** Deserialize KB content JSON to ToolCacheEntry. Returns null on parse failure. */
export function entryFromKbContent(content: string, scope: string): ToolCacheEntry | null {
  try {
    const data = JSON.parse(content);
    if (!data.tool_name || !data.server_name) return null;
    return {
      toolName: data.tool_name,
      serverName: data.server_name,
      description: data.description ?? '',
      inputSchema: data.input_schema ?? {},
      scope,
      hits: data.hits ?? 0,
      lastUsed: data.last_used ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Create a new ToolCacheEntry from tool execution result. */
export function createToolCacheEntry(
  toolName: string, serverName: string, description: string,
  inputSchema: Record<string, any>, scope: string
): ToolCacheEntry {
  return {
    toolName, serverName, description, inputSchema, scope,
    hits: 1,
    lastUsed: new Date().toISOString(),
  };
}
