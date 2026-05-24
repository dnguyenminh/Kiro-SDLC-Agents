/**
 * KB Cache Models — data structures for 2-level agent tool cache registry.
 * KSA-139: L1 (global) + L2 (per-agent) KB-backed cache entries.
 */
export declare enum CacheSource {
    L2_CACHE = "l2_cache",
    L1_CACHE = "l1_cache",
    DISCOVERED = "discovered"
}
export interface ToolCacheEntry {
    toolName: string;
    serverName: string;
    description: string;
    inputSchema: Record<string, any>;
    scope: string;
    hits: number;
    lastUsed: string;
}
/** Build deterministic KB title for dedup. */
export declare function cacheTitle(scope: string, toolName: string): string;
/** Build KB tags string for a cache entry. */
export declare function cacheTags(scope: string, serverName: string): string;
/** Serialize entry to KB content JSON string. */
export declare function entryToKbContent(entry: ToolCacheEntry): string;
/** Deserialize KB content JSON to ToolCacheEntry. Returns null on parse failure. */
export declare function entryFromKbContent(content: string, scope: string): ToolCacheEntry | null;
/** Create a new ToolCacheEntry from tool execution result. */
export declare function createToolCacheEntry(toolName: string, serverName: string, description: string, inputSchema: Record<string, any>, scope: string): ToolCacheEntry;
//# sourceMappingURL=kb-models.d.ts.map