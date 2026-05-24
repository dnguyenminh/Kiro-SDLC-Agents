/**
 * KbCacheInvalidator — remove stale cache entries on permanent failure.
 * KSA-139: Classifies errors and invalidates only on permanent failures.
 */
package com.codeintel.orchestration.cache

import com.codeintel.log
import com.codeintel.memory.MemoryEngine

class KbCacheInvalidator(private val memoryEngine: MemoryEngine?) {

    /** Handle failed tool execution — invalidate if permanent error. */
    fun onFailure(toolName: String, agentName: String, errorMessage: String) {
        if (memoryEngine == null) return
        if (isTransientError(errorMessage)) {
            log("[kb-cache-invalidator] Transient error for $toolName, keeping cache")
            return
        }
        if (isServerDisconnect(errorMessage)) {
            log("[kb-cache-invalidator] Server disconnect for $toolName")
            return
        }
        deleteEntry("agent:$agentName", toolName)
        deleteEntry("global", toolName)
        log("[kb-cache-invalidator] Invalidated $toolName (permanent)")
    }

    private fun deleteEntry(scope: String, toolName: String) {
        try {
            val title = cacheTitle(scope, toolName)
            val results = memoryEngine?.search?.search(title, limit = 1) ?: return
            if (results.isEmpty()) return
            val id = results.first().entry.id
            if (id > 0) memoryEngine?.knowledge?.delete(id)
        } catch (e: Exception) {
            log("[kb-cache-invalidator] Delete error: ${e.message}")
        }
    }

    private fun isTransientError(msg: String): Boolean {
        val transient = listOf("timeout", "timed out", "ECONNRESET", "EPIPE", "retry")
        return transient.any { msg.contains(it, ignoreCase = true) }
    }

    private fun isServerDisconnect(msg: String): Boolean {
        val disconnect = listOf("ECONNREFUSED", "server disconnected", "process exited")
        return disconnect.any { msg.contains(it, ignoreCase = true) }
    }
}
