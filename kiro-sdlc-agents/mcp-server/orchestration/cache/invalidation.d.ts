/**
 * Cache invalidation — stale entry detection and LRU eviction logic.
 */
import { CacheEntry } from './cache-entry.js';
/** Remove entries with mismatched registry hash. Returns [kept, removedCount]. */
export declare function invalidateStale(entries: CacheEntry[], currentHash: string): [CacheEntry[], number];
/** Evict least-recently-used entries if over maxSize. */
export declare function evictLru(entries: CacheEntry[], maxSize?: number): CacheEntry[];
/** Compute Jaccard-like overlap between query tokens and entry tokens. */
export declare function computeTokenOverlap(queryTokens: Set<string>, entryTokens: Set<string>): number;
//# sourceMappingURL=invalidation.d.ts.map