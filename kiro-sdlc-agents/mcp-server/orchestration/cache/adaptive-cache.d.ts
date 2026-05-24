/**
 * AdaptiveTokenCache — self-learning fuzzy token cache for find_tools.
 */
import { CacheEntry } from './cache-entry.js';
export declare class AdaptiveTokenCache {
    private persistence;
    private entries;
    private loaded;
    private hits;
    private misses;
    constructor(cachePath: string, debounceS?: number);
    /** Find best cache entry with ≥threshold token overlap. */
    findFuzzy(tokens: Set<string>, threshold?: number): CacheEntry | null;
    /** Add or update cache entry from embedding result. */
    add(tokens: Set<string>, toolName: string, score: number, registryHash: string): void;
    /** Remove entries with mismatched registry hash. */
    invalidateStale(currentHash: string): number;
    /** Schedule debounced write to disk. */
    schedulePersist(): void;
    /** Force load from disk. */
    load(): void;
    get size(): number;
    get hitRate(): number;
    private ensureLoaded;
    private doLoad;
    private findExact;
    private mergeEntry;
    private serialize;
}
//# sourceMappingURL=adaptive-cache.d.ts.map