/**
 * AdaptiveTokenCache — self-learning fuzzy token cache for find_tools.
 */
package com.codeintel.orchestration.cache

import com.codeintel.log
import kotlinx.serialization.json.*

private const val DEFAULT_THRESHOLD = 0.80
private const val DEFAULT_CONFIDENCE = 0.75

class AdaptiveTokenCache(cachePath: String, debounceS: Double = 5.0) {
    private val persistence = CachePersistence(cachePath, (debounceS * 1000).toLong())
    private val entries = mutableListOf<CacheEntry>()
    private var loaded = false
    private var hits = 0
    private var misses = 0

    /** Find best cache entry with ≥threshold token overlap. */
    fun findFuzzy(tokens: Set<String>, threshold: Double = DEFAULT_THRESHOLD): CacheEntry? {
        ensureLoaded()
        var best: CacheEntry? = null
        var bestOverlap = 0.0
        for (entry in entries) {
            val overlap = computeTokenOverlap(tokens, entry.tokens)
            if (overlap >= threshold && overlap > bestOverlap) {
                best = entry
                bestOverlap = overlap
            }
        }
        if (best != null) { hits++; best.touch() } else { misses++ }
        return best
    }

    /** Add or update cache entry from embedding result. */
    fun add(tokens: Set<String>, toolName: String, score: Double, registryHash: String) {
        ensureLoaded()
        if (score < DEFAULT_CONFIDENCE) return
        val existing = findExact(toolName, tokens)
        if (existing != null) {
            mergeEntry(existing, tokens, score)
        } else {
            entries.add(CacheEntry(tokens = tokens, toolName = toolName, score = score, registryHash = registryHash))
        }
        val evicted = evictLru(entries)
        entries.clear()
        entries.addAll(evicted)
    }

    /** Remove entries with mismatched registry hash. */
    fun invalidateStale(currentHash: String): Int {
        ensureLoaded()
        val (kept, removed) = invalidateStale(entries.toList(), currentHash)
        entries.clear()
        entries.addAll(kept)
        if (removed > 0) schedulePersist()
        return removed
    }

    /** Schedule debounced write to disk. */
    fun schedulePersist() { persistence.scheduleWrite(serialize()) }

    /** Force load from disk. */
    fun load() { doLoad() }

    val size: Int get() { ensureLoaded(); return entries.size }
    val hitRate: Double get() {
        val total = hits + misses
        return if (total > 0) hits.toDouble() / total else 0.0
    }

    private fun ensureLoaded() { if (!loaded) doLoad() }

    @Suppress("UNCHECKED_CAST")
    private fun doLoad() {
        loaded = true
        val data = persistence.load() ?: return
        val rawEntries = data["entries"] as? List<Map<String, Any?>> ?: return
        entries.addAll(rawEntries.map { CacheEntry.fromMap(it) })
        log("[adaptive-cache] Loaded ${entries.size} cache entries")
    }

    private fun findExact(toolName: String, tokens: Set<String>): CacheEntry? {
        return entries.firstOrNull { it.toolName == toolName && computeTokenOverlap(tokens, it.tokens) >= 0.6 }
    }

    private fun mergeEntry(entry: CacheEntry, newTokens: Set<String>, score: Double) {
        entry.tokens = entry.tokens + newTokens
        entry.score = maxOf(entry.score, score)
        entry.touch()
    }

    private fun serialize(): String {
        val obj = buildJsonObject {
            put("version", 1)
            putJsonArray("entries") {
                for (e in entries) {
                    addJsonObject {
                        putJsonArray("tokens") { e.tokens.sorted().forEach { add(it) } }
                        put("tool_name", e.toolName)
                        put("score", e.score)
                        put("timestamp", e.timestamp)
                        put("hit_count", e.hitCount)
                        put("last_hit", e.lastHit)
                        put("tool_version", e.registryHash)
                    }
                }
            }
        }
        return Json { prettyPrint = true }.encodeToString(JsonObject.serializer(), obj)
    }
}
