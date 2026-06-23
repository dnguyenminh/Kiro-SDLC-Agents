/**
 * KB Cache Models — data structures for 2-level agent tool cache registry.
 * KSA-139: L1 (global) + L2 (per-agent) KB-backed cache entries.
 */
package com.codeintel.orchestration.cache

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.time.Instant

enum class CacheSource { L2_CACHE, L1_CACHE, DISCOVERED }

@Serializable
data class ToolCacheEntry(
    val toolName: String,
    val serverName: String,
    val description: String,
    val inputSchema: JsonObject = buildJsonObject {},
    val scope: String,
    val hits: Int = 1,
    val lastUsed: String = Instant.now().toString()
)

/** Build deterministic KB title for dedup. */
fun cacheTitle(scope: String, toolName: String): String = "tool-cache:$scope:$toolName"

/** Build KB tags string for a cache entry. */
fun cacheTags(scope: String, serverName: String): String {
    val base = "tool-cache"
    return if (scope == "global") "$base, scope:global, server:$serverName"
    else "$base, $scope, server:$serverName"
}

/** Serialize entry to KB content JSON string. */
fun entryToKbContent(entry: ToolCacheEntry): String {
    val obj = buildJsonObject {
        put("tool_name", entry.toolName)
        put("server_name", entry.serverName)
        put("description", entry.description)
        put("input_schema", entry.inputSchema)
        put("hits", entry.hits)
        put("last_used", entry.lastUsed)
    }
    return obj.toString()
}

/** Deserialize KB content JSON to ToolCacheEntry. Returns null on parse failure. */
fun entryFromKbContent(content: String, scope: String): ToolCacheEntry? {
    return try {
        val data = Json.parseToJsonElement(content).jsonObject
        val toolName = data["tool_name"]?.jsonPrimitive?.content ?: return null
        val serverName = data["server_name"]?.jsonPrimitive?.content ?: return null
        ToolCacheEntry(
            toolName = toolName,
            serverName = serverName,
            description = data["description"]?.jsonPrimitive?.content ?: "",
            inputSchema = data["input_schema"]?.jsonObject ?: buildJsonObject {},
            scope = scope,
            hits = data["hits"]?.jsonPrimitive?.int ?: 0,
            lastUsed = data["last_used"]?.jsonPrimitive?.content ?: Instant.now().toString()
        )
    } catch (_: Exception) { null }
}
