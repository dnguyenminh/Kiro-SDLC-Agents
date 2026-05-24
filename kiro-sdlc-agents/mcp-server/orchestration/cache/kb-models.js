"use strict";
/**
 * KB Cache Models — data structures for 2-level agent tool cache registry.
 * KSA-139: L1 (global) + L2 (per-agent) KB-backed cache entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheSource = void 0;
exports.cacheTitle = cacheTitle;
exports.cacheTags = cacheTags;
exports.entryToKbContent = entryToKbContent;
exports.entryFromKbContent = entryFromKbContent;
exports.createToolCacheEntry = createToolCacheEntry;
var CacheSource;
(function (CacheSource) {
    CacheSource["L2_CACHE"] = "l2_cache";
    CacheSource["L1_CACHE"] = "l1_cache";
    CacheSource["DISCOVERED"] = "discovered";
})(CacheSource || (exports.CacheSource = CacheSource = {}));
/** Build deterministic KB title for dedup. */
function cacheTitle(scope, toolName) {
    return `tool-cache:${scope}:${toolName}`;
}
/** Build KB tags string for a cache entry. */
function cacheTags(scope, serverName) {
    const base = 'tool-cache';
    if (scope === 'global') {
        return `${base}, scope:global, server:${serverName}`;
    }
    return `${base}, ${scope}, server:${serverName}`;
}
/** Serialize entry to KB content JSON string. */
function entryToKbContent(entry) {
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
function entryFromKbContent(content, scope) {
    try {
        const data = JSON.parse(content);
        if (!data.tool_name || !data.server_name)
            return null;
        return {
            toolName: data.tool_name,
            serverName: data.server_name,
            description: data.description ?? '',
            inputSchema: data.input_schema ?? {},
            scope,
            hits: data.hits ?? 0,
            lastUsed: data.last_used ?? new Date().toISOString(),
        };
    }
    catch {
        return null;
    }
}
/** Create a new ToolCacheEntry from tool execution result. */
function createToolCacheEntry(toolName, serverName, description, inputSchema, scope) {
    return {
        toolName, serverName, description, inputSchema, scope,
        hits: 1,
        lastUsed: new Date().toISOString(),
    };
}
//# sourceMappingURL=kb-models.js.map