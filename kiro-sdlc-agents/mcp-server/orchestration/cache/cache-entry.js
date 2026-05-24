"use strict";
/**
 * CacheEntry — interface and helpers for adaptive token cache entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCacheEntry = createCacheEntry;
exports.touchEntry = touchEntry;
exports.isStale = isStale;
exports.entryToJson = entryToJson;
exports.entryFromJson = entryFromJson;
/** Create a new CacheEntry. */
function createCacheEntry(tokens, toolName, score, registryHash) {
    const now = nowIso();
    return { tokens, toolName, score, registryHash, timestamp: now, hitCount: 0, lastHit: now };
}
/** Record a cache hit on an entry. */
function touchEntry(entry) {
    entry.hitCount++;
    entry.lastHit = nowIso();
}
/** Check if entry is stale (registry changed). */
function isStale(entry, currentHash) {
    return entry.registryHash !== currentHash;
}
/** Serialize entry to JSON-compatible object. */
function entryToJson(entry) {
    return {
        tokens: [...entry.tokens].sort(),
        tool_name: entry.toolName,
        score: entry.score,
        timestamp: entry.timestamp,
        hit_count: entry.hitCount,
        last_hit: entry.lastHit,
        tool_version: entry.registryHash,
    };
}
/** Deserialize entry from JSON object. */
function entryFromJson(data) {
    return {
        tokens: new Set(data.tokens ?? []),
        toolName: data.tool_name ?? '',
        score: data.score ?? 0,
        registryHash: data.tool_version ?? '',
        timestamp: data.timestamp ?? nowIso(),
        hitCount: data.hit_count ?? 0,
        lastHit: data.last_hit ?? nowIso(),
    };
}
function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
//# sourceMappingURL=cache-entry.js.map