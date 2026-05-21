/**
 * Cache invalidation — stale entry detection and LRU eviction logic.
 */
package com.codeintel.orchestration.cache

import com.codeintel.log

const val MAX_CACHE_SIZE = 10_000

/** Remove entries with mismatched registry hash. Returns Pair(kept, removedCount). */
fun invalidateStale(entries: List<CacheEntry>, currentHash: String): Pair<List<CacheEntry>, Int> {
    val kept = entries.filter { !it.isStale(currentHash) }
    val removed = entries.size - kept.size
    if (removed > 0) log("[cache-invalidation] Invalidated $removed stale entries")
    return kept to removed
}

/** Evict least-recently-used entries if over maxSize. */
fun evictLru(entries: List<CacheEntry>, maxSize: Int = MAX_CACHE_SIZE): List<CacheEntry> {
    if (entries.size <= maxSize) return entries
    val sorted = entries.sortedByDescending { it.lastHit }
    val evicted = entries.size - maxSize
    log("[cache-invalidation] LRU eviction: removed $evicted entries")
    return sorted.take(maxSize)
}

/** Compute Jaccard-like overlap between query tokens and entry tokens. */
fun computeTokenOverlap(queryTokens: Set<String>, entryTokens: Set<String>): Double {
    if (queryTokens.isEmpty() || entryTokens.isEmpty()) return 0.0
    val intersection = queryTokens.intersect(entryTokens).size
    val union = queryTokens.union(entryTokens).size
    return intersection.toDouble() / union.toDouble()
}
