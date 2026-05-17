/**
 * Unified registry — merges native tools + child server tools into a single searchable index.
 * Supports fallback chains: same tool name on multiple servers → ordered by config priority.
 * Child tools are NOT exposed in tools/list — only searchable via find_tools.
 */
package com.codeintel.orchestration.registry

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

data class RegisteredTool(
    val name: String,
    val definition: JsonObject,
    val source: String,
    val priority: Int = 0
)

/** Ordered chain of servers that provide the same tool name. */
data class ToolChain(
    val toolName: String,
    val entries: List<ChainEntry>
)

data class ChainEntry(val serverName: String, val priority: Int)

class UnifiedRegistry {
    private var nativeTools: List<RegisteredTool> = emptyList()
    private var childTools: List<RegisteredTool> = emptyList()
    private var merged: List<RegisteredTool> = emptyList()
    private val toggles = mutableMapOf<String, Boolean>()
    private val chains = mutableMapOf<String, ToolChain>()
    private var serverOrder: List<String> = emptyList()

    /** Set config-declared server order (determines fallback priority). */
    fun setServerOrder(order: List<String>) { serverOrder = order }

    /** Set native tool definitions (code_* + mem_*). */
    fun setNativeTools(tools: List<JsonObject>) {
        nativeTools = tools.map { def ->
            val name = def["name"]?.jsonPrimitive?.content ?: "unknown"
            RegisteredTool(name, def, "native", priority = Int.MAX_VALUE)
        }
        rebuild()
    }

    /** Set child server tool definitions (from all active children). */
    fun setChildTools(serverName: String, tools: List<JsonObject>) {
        val filtered = tools.filter { def ->
            val name = def["name"]?.jsonPrimitive?.content ?: ""
            name !in META_TOOL_NAMES
        }
        val priority = serverOrder.indexOf(serverName).let { if (it < 0) 999 else it }
        childTools = childTools.filter { it.source != "child:$serverName" } +
            filtered.map { def ->
                val name = def["name"]?.jsonPrimitive?.content ?: "unknown"
                RegisteredTool(name, def, "child:$serverName", priority)
            }
        rebuild()
    }

    companion object {
        private val META_TOOL_NAMES = setOf(
            "find_tools", "execute_dynamic_tool", "toggle_tool",
            "reset_tools", "manage_auto_approve", "orchestration_status", "agent_log"
        )
    }

    /** Get all enabled tool definitions (respects toggles). */
    fun getAll(): List<JsonObject> = merged.filter { isEnabled(it.name) }.map { it.definition }

    /** Find a tool by name. Returns null if not found or disabled. */
    fun find(name: String): RegisteredTool? =
        merged.firstOrNull { it.name == name && isEnabled(it.name) }

    /** Get fallback chain for a tool name — ordered by config priority (lower = higher). */
    fun getChain(toolName: String): ToolChain? = chains[toolName]

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
    fun childToolsByServer(): Map<String, List<String>> =
        childTools.groupBy { it.source }.mapValues { (_, tools) -> tools.map { it.name } }

    /** Get all child tools as flat list (for KB ingestion). */
    fun allChildTools(): List<RegisteredTool> = childTools

    private fun rebuild() {
        val map = mutableMapOf<String, RegisteredTool>()
        childTools.forEach { map[it.name] = it }
        nativeTools.forEach { map[it.name] = it }
        merged = map.values.toList()
        rebuildChains()
    }

    private fun rebuildChains() {
        chains.clear()
        val grouped = childTools.groupBy { it.name }
        for ((name, tools) in grouped) {
            if (tools.size < 2) continue
            val entries = tools
                .map { ChainEntry(it.source.removePrefix("child:"), it.priority) }
                .sortedBy { it.priority }
            chains[name] = ToolChain(name, entries)
        }
    }
}
