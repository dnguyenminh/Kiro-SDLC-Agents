/**
 * CacheEntry — interface and helpers for adaptive token cache entries.
 */
export interface CacheEntry {
    tokens: Set<string>;
    toolName: string;
    score: number;
    registryHash: string;
    timestamp: string;
    hitCount: number;
    lastHit: string;
}
/** Create a new CacheEntry. */
export declare function createCacheEntry(tokens: Set<string>, toolName: string, score: number, registryHash: string): CacheEntry;
/** Record a cache hit on an entry. */
export declare function touchEntry(entry: CacheEntry): void;
/** Check if entry is stale (registry changed). */
export declare function isStale(entry: CacheEntry, currentHash: string): boolean;
/** Serialize entry to JSON-compatible object. */
export declare function entryToJson(entry: CacheEntry): Record<string, any>;
/** Deserialize entry from JSON object. */
export declare function entryFromJson(data: Record<string, any>): CacheEntry;
//# sourceMappingURL=cache-entry.d.ts.map