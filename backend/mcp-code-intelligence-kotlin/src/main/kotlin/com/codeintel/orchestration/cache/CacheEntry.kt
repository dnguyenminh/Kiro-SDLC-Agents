/**
 * CacheEntry — data class for adaptive token cache entries.
 */
package com.codeintel.orchestration.cache

import kotlinx.serialization.Serializable
import java.time.Instant

@Serializable
data class CacheEntry(
    var tokens: Set<String>,
    val toolName: String,
    var score: Double,
    val registryHash: String,
    val timestamp: String = nowIso(),
    var hitCount: Int = 0,
    var lastHit: String = nowIso()
) {
    /** Record a cache hit. */
    fun touch() {
        hitCount++
        lastHit = nowIso()
    }

    /** Check if entry is stale (registry changed). */
    fun isStale(currentHash: String): Boolean = registryHash != currentHash

    /** Serialize to JSON-compatible map. */
    fun toMap(): Map<String, Any> = mapOf(
        "tokens" to tokens.sorted(),
        "tool_name" to toolName,
        "score" to score,
        "timestamp" to timestamp,
        "hit_count" to hitCount,
        "last_hit" to lastHit,
        "tool_version" to registryHash
    )

    companion object {
        /** Deserialize from JSON map. */
        fun fromMap(data: Map<String, Any?>): CacheEntry {
            val tokens = (data["tokens"] as? List<*>)?.mapNotNull { it?.toString() }?.toSet() ?: emptySet()
            return CacheEntry(
                tokens = tokens,
                toolName = data["tool_name"]?.toString() ?: "",
                score = (data["score"] as? Number)?.toDouble() ?: 0.0,
                registryHash = data["tool_version"]?.toString() ?: "",
                timestamp = data["timestamp"]?.toString() ?: nowIso(),
                hitCount = (data["hit_count"] as? Number)?.toInt() ?: 0,
                lastHit = data["last_hit"]?.toString() ?: nowIso()
            )
        }
    }
}

internal fun nowIso(): String = Instant.now().toString().replace(Regex("\\.\\d+Z$"), "Z")
