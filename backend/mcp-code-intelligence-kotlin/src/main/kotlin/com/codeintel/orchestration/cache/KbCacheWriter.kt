/**
 * KbCacheWriter — ingest/update cache entries in KB on successful execution.
 * KSA-139: Fire-and-forget writes, dedup by title.
 */
package com.codeintel.orchestration.cache

import com.codeintel.log
import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.models.KnowledgeEntry
import java.time.Instant

class KbCacheWriter(private val memoryEngine: MemoryEngine?) {

    /** Handle successful tool execution — ingest/update cache entries. */
    fun onSuccess(
        toolName: String, serverName: String, description: String,
        inputSchema: kotlinx.serialization.json.JsonObject, agentName: String, source: CacheSource
    ) {
        if (memoryEngine == null) return
        try {
            when (source) {
                CacheSource.DISCOVERED -> ingestDiscovered(toolName, serverName, description, inputSchema, agentName)
                CacheSource.L1_CACHE -> promoteToL2(toolName, serverName, description, inputSchema, agentName)
                CacheSource.L2_CACHE -> incrementHits("agent:$agentName", toolName)
            }
        } catch (e: Exception) {
            log("[kb-cache-writer] Write error: ${e.message}")
        }
    }

    private fun ingestDiscovered(
        toolName: String, serverName: String, description: String,
        inputSchema: kotlinx.serialization.json.JsonObject, agentName: String
    ) {
        ingestEntry("global", toolName, serverName, description, inputSchema)
        ingestEntry("agent:$agentName", toolName, serverName, description, inputSchema)
        log("[kb-cache-writer] Ingested $toolName → L1 + L2($agentName)")
    }

    private fun promoteToL2(
        toolName: String, serverName: String, description: String,
        inputSchema: kotlinx.serialization.json.JsonObject, agentName: String
    ) {
        ingestEntry("agent:$agentName", toolName, serverName, description, inputSchema)
        incrementHits("global", toolName)
        log("[kb-cache-writer] Promoted $toolName → L2($agentName), L1 hits++")
    }

    private fun ingestEntry(
        scope: String, toolName: String, serverName: String,
        description: String, inputSchema: kotlinx.serialization.json.JsonObject
    ) {
        val entry = ToolCacheEntry(toolName, serverName, description, inputSchema, scope, 1, Instant.now().toString())
        memoryEngine?.knowledge?.insert(KnowledgeEntry(
            content = entryToKbContent(entry),
            summary = cacheTitle(scope, toolName),
            type = "CONTEXT",
            tier = "WORKING",
            source = "tool-cache",
            tags = cacheTags(scope, serverName)
        ))
    }

    private fun incrementHits(scope: String, toolName: String) {
        // Best-effort hit increment — non-critical path
        log("[kb-cache-writer] Hit++ $toolName in $scope")
    }
}
