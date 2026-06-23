/**
 * CompressionCache — Two-Tier LRU Cache
 * KSA-244: Skip Set (10K entries) + Result Cache (500 entries)
 *
 * Uses Map insertion order for O(1) LRU eviction.
 * Hash: SHA-256 truncated to 16 bytes (32 hex chars).
 * Budget: < 0.05ms per lookup.
 */
import { CacheResult, CompressionResult } from './types.js';
export declare class CompressionCache {
    private maxSkipSet;
    private maxResultCache;
    private skipSet;
    private resultCache;
    private hits;
    private misses;
    constructor(maxSkipSet?: number, maxResultCache?: number);
    lookup(content: string): CacheResult;
    store(content: string, result: CompressionResult): void;
    getStats(): {
        hits: number;
        misses: number;
        hitRate: number;
        skipSetSize: number;
        resultCacheSize: number;
    };
    private hash;
    private addToSkipSet;
    private addToResultCache;
}
//# sourceMappingURL=compression-cache.d.ts.map