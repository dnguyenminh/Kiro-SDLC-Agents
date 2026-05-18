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
    val priority: Int = 0,
    val nameTokens: Set<String> = emptySet(),
    val descTokens: Set<String> = emptySet()
)

/** Ordered chain of servers that provide the same tool name. */
data class ToolChain(
    val toolName: String,
    val entries: List<ChainEntry>,
    val groupingReason: String = "exact_name",
    val similarNames: Set<String> = emptySet()
)

data class ChainEntry(
    val serverName: String,
    val priority: Int,
    val toolName: String? = null
)

class UnifiedRegistry(private val similarityThreshold: Double = 0.7) {
    private var nativeTools: List<RegisteredTool> = emptyList()
    private var childTools: List<RegisteredTool> = emptyList()
    private var merged: List<RegisteredTool> = emptyList()
    private val toggles = mutableMapOf<String, Boolean>()
    private val chains = mutableMapOf<String, ToolChain>()
    private var serverOrder: List<String> = emptyList()
    private val hits = java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger>()

    /** Set config-declared server order (determines fallback priority). */
    fun setServerOrder(order: List<String>) { serverOrder = order }

    /** Set native tool definitions (code_* + mem_*). */
    fun setNativeTools(tools: List<JsonObject>) {
        nativeTools = tools.map { def ->
            val name = def["name"]?.jsonPrimitive?.content ?: "unknown"
            val desc = def["description"]?.jsonPrimitive?.content ?: ""
            RegisteredTool(name, def, "native", Int.MAX_VALUE, Tokenizer.tokenize(name), Tokenizer.tokenize(desc))
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
                val desc = def["description"]?.jsonPrimitive?.content ?: ""
                RegisteredTool(name, def, "child:$serverName", priority, Tokenizer.tokenize(name), Tokenizer.tokenize(desc))
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

    /** Tokenized search — scores tools by relevance + popularity (hits). */
    fun search(query: String): List<RegisteredTool> {
        val terms = Tokenizer.tokenize(query)
        if (terms.isEmpty()) return merged.filter { isEnabled(it.name) }
        val maxHits = hits.values.maxOfOrNull { it.get() }?.coerceAtLeast(1) ?: 1
        return merged
            .filter { isEnabled(it.name) }
            .map { tool -> tool to combinedScore(tool, terms, maxHits) }
            .filter { it.second > 0.0 }
            .sortedByDescending { it.second }
            .map { it.first }
    }

    private fun combinedScore(tool: RegisteredTool, terms: Set<String>, maxHits: Int): Double {
        val relevance = scoreAgainstTerms(tool, terms)
        if (relevance <= 0.0) return 0.0
        val toolHits = hits[tool.name]?.get() ?: 0
        val normalizedHits = toolHits.toDouble() / maxHits.toDouble()
        return relevance * 0.7 + normalizedHits * 0.3
    }

    private fun scoreAgainstTerms(tool: RegisteredTool, queryTerms: Set<String>): Double {
        var score = 0.0
        for (term in queryTerms) {
            when {
                term in tool.nameTokens -> score += 2.0
                tool.descTokens.any { it.contains(term) } -> score += 1.0
            }
        }
        return if (queryTerms.isNotEmpty()) score / (queryTerms.size * 2.0) else 0.0
    }

    /** Record a successful tool execution hit. Triggers decay if threshold exceeded. */
    fun recordHit(toolName: String) {
        val counter = hits.computeIfAbsent(toolName) { java.util.concurrent.atomic.AtomicInteger(0) }
        val newVal = counter.incrementAndGet()
        if (newVal > 1000) applyDecay(toolName)
    }

    /** Decay: subtract 500 from all tools in same chain/group. Floor at -2000. */
    private fun applyDecay(triggerTool: String) {
        val chain = chains[triggerTool]
        val groupNames = if (chain != null) {
            chain.entries.map { it.toolName ?: chain.toolName }.toSet() + chain.similarNames
        } else setOf(triggerTool)
        for (name in groupNames) {
            val c = hits[name] ?: continue
            c.addAndGet(-500)
            if (c.get() < -2000) c.set(-2000)
        }
    }

    /** Get current hits for a tool (for testing/observability). */
    fun getHits(toolName: String): Int = hits[toolName]?.get() ?: 0

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
        val grouper = SemanticGrouper(similarityThreshold)
        val newChains = grouper.buildChains(childTools)
        chains.clear()
        chains.putAll(newChains)
    }
}
