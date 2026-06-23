/**
 * KbCacheLookup — search KB for cached tools using L2 → L1 cascade.
 * KSA-139: Agent-scope first, then global scope.
 */
package com.codeintel.orchestration.cache

import com.codeintel.log
import com.codeintel.memory.MemoryEngine

data class KbLookupResult(val entry: ToolCacheEntry, val source: CacheSource)

class KbCacheLookup(private val memoryEngine: MemoryEngine?) {

    /** Lookup cascade: L2 (agent scope) → L1 (global scope). */
    fun find(query: String, agentName: String): KbLookupResult? {
        if (memoryEngine == null) return null
        val l2 = searchScope(query, "agent:$agentName")
        if (l2 != null) {
            log("[kb-cache] L2 hit: ${l2.toolName} for $agentName (hits=${l2.hits})")
            return KbLookupResult(l2, CacheSource.L2_CACHE)
        }
        val l1 = searchScope(query, "global")
        if (l1 != null) {
            log("[kb-cache] L1 hit: ${l1.toolName} for $agentName (hits=${l1.hits})")
            return KbLookupResult(l1, CacheSource.L1_CACHE)
        }
        return null
    }

    /** Search KB with specific scope tags. Returns best match or null. */
    private fun searchScope(query: String, scope: String): ToolCacheEntry? {
        return try {
            val results = memoryEngine?.search?.search("tool-cache $query", limit = 5) ?: return null
            for (result in results) {
                val content = result.entry.content
                if (!content.contains("tool_name")) continue
                val entry = entryFromKbContent(content, scope) ?: continue
                if (matchesScope(result.entry.tags, scope)) return entry
            }
            null
        } catch (e: Exception) {
            log("[kb-cache] Search error ($scope): ${e.message}")
            null
        }
    }

    private fun matchesScope(tags: String, scope: String): Boolean {
        if (scope == "global") return tags.contains("scope:global")
        return tags.contains(scope)
    }
}
