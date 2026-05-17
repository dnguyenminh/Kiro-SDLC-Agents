/**
 * Unified registry — merges native tools + child server tools into a single list.
 * Supports session-scoped toggles (enable/disable tools at runtime).
 * Priority: native tools always override child tools with same name.
 */
package com.codeintel.orchestration.registry

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

data class RegisteredTool(
    val name: String,
    val definition: JsonObject,
    val source: String
)

class UnifiedRegistry {
    private var nativeTools: List<RegisteredTool> = emptyList()
    private var childTools: List<RegisteredTool> = emptyList()
    private var merged: List<RegisteredTool> = emptyList()
    private val toggles = mutableMapOf<String, Boolean>()

    /** Set native tool definitions (code_* + mem_*). */
    fun setNativeTools(tools: List<JsonObject>) {
        nativeTools = tools.map { def ->
            val name = def["name"]?.jsonPrimitive?.content ?: "unknown"
            RegisteredTool(name, def, "native")
        }
        rebuild()
    }

    /** Set child server tool definitions (from all active children). */
    fun setChildTools(serverName: String, tools: List<JsonObject>) {
        // Remove old tools from this server, add new ones
        childTools = childTools.filter { it.source != "child:$serverName" } +
            tools.map { def ->
                val name = def["name"]?.jsonPrimitive?.content ?: "unknown"
                RegisteredTool(name, def, "child:$serverName")
            }
        rebuild()
    }

    /** Get all enabled tool definitions (respects toggles). */
    fun getAll(): List<JsonObject> = merged.filter { isEnabled(it.name) }.map { it.definition }

    /** Find a tool by name. Returns null if not found or disabled. */
    fun find(name: String): RegisteredTool? =
        merged.firstOrNull { it.name == name && isEnabled(it.name) }

    /** Fuzzy search tools by name or description keyword. */
    fun search(query: String): List<RegisteredTool> {
        val q = query.lowercase()
        return merged.filter { tool ->
            isEnabled(tool.name) && (
                tool.name.lowercase().contains(q) ||
                tool.definition.toString().lowercase().contains(q)
            )
        }
    }

    /** Toggle a tool on/off for this session. */
    fun toggle(toolName: String, enabled: Boolean) { toggles[toolName] = enabled }

    /** Reset all session toggles to default (all enabled). */
    fun resetToggles() { toggles.clear() }

    /** Check if a tool is enabled. */
    fun isEnabled(toolName: String): Boolean = toggles[toolName] ?: true

    /** Get child tool names grouped by server. */
    fun childToolsByServer(): Map<String, List<String>> {
        return childTools.groupBy { it.source }.mapValues { (_, tools) -> tools.map { it.name } }
    }

    private fun rebuild() {
        val map = mutableMapOf<String, RegisteredTool>()
        childTools.forEach { map[it.name] = it }
        nativeTools.forEach { map[it.name] = it } // Native wins
        merged = map.values.toList()
    }
}
