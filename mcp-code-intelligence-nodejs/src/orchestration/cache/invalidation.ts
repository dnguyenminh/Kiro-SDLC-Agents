/**
 * Cache invalidation — stale entry detection and LRU eviction logic.
 */

import { CacheEntry, isStale } from './cache-entry.js';

const MAX_CACHE_SIZE = 10_000;

/** Remove entries with mismatched registry hash. Returns [kept, removedCount]. */
export function invalidateStale(entries: CacheEntry[], currentHash: string): [CacheEntry[], number] {
  const kept = entries.filter((e) => !isStale(e, currentHash));
  const removed = entries.length - kept.length;
  if (removed > 0) {
    console.error(`[cache-invalidation] Invalidated ${removed} stale entries`);
  }
  return [kept, removed];
}

/** Evict least-recently-used entries if over maxSize. */
export function evictLru(entries: CacheEntry[], maxSize: number = MAX_CACHE_SIZE): CacheEntry[] {
  if (entries.length <= maxSize) return entries;
  const sorted = [...entries].sort((a, b) => b.lastHit.localeCompare(a.lastHit));
  const evicted = entries.length - maxSize;
  console.error(`[cache-invalidation] LRU eviction: removed ${evicted} entries`);
  return sorted.slice(0, maxSize);
}

/** Compute Jaccard-like overlap between query tokens and entry tokens. */
export function computeTokenOverlap(queryTokens: Set<string>, entryTokens: Set<string>): number {
  if (queryTokens.size === 0 || entryTokens.size === 0) return 0;
  let intersection = 0;
  for (const t of queryTokens) {
    if (entryTokens.has(t)) intersection++;
  }
  const union = new Set([...queryTokens, ...entryTokens]).size;
  return intersection / union;
}
