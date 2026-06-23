/**
 * ExecuteCacheHooks — fire-and-forget KB cache write/invalidate after tool execution.
 * KSA-139/141: Post-execution hooks for KB cache population/invalidation.
 */
package com.codeintel.orchestration.meta

import com.codeintel.orchestration.OrchestrationEngine
import com.codeintel.orchestration.cache.CacheSource
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Fire-and-forget: write to KB cache on success (KSA-139/141). */
fun fireCacheWrite(engine: OrchestrationEngine, toolName: String, serverName: String, agentName: String) {
    try {
        val writer = engine.getKbCacheWriter()
        val tool = engine.getRegistry().find(toolName)
        val description = tool?.definition?.get("description")?.jsonPrimitive?.content ?: ""
        val inputSchema = tool?.definition?.get("inputSchema") as? JsonObject ?: buildJsonObject {}
        writer.onSuccess(toolName, serverName, description, inputSchema, agentName, CacheSource.DISCOVERED)
    } catch (_: Exception) {
        // Non-blocking — never fail execution due to cache
    }
}

/** Fire-and-forget: invalidate KB cache on failure (KSA-139/141). */
fun fireCacheInvalidate(engine: OrchestrationEngine, toolName: String, agentName: String, errorResult: String) {
    try {
        val invalidator = engine.getKbCacheInvalidator()
        invalidator.onFailure(toolName, agentName, errorResult)
    } catch (_: Exception) {
        // Non-blocking
    }
}
