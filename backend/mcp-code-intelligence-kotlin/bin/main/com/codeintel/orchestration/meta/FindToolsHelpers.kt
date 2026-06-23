/**
 * FindToolsHelpers — extracted helpers for find_tools KB search and multilingual hints.
 * KSA-141: Keeps FindToolsTool.kt under 200 lines.
 */
package com.codeintel.orchestration.meta

import com.codeintel.log
import com.codeintel.orchestration.OrchestrationEngine
import com.codeintel.orchestration.registry.RegisteredTool

/** Search KB for tool definitions (best-effort, graceful degradation). */
fun searchKbForTools(engine: OrchestrationEngine, query: String): List<RegisteredTool> {
    val mem = engine.getMemoryEngine() ?: return emptyList()
    return try {
        val results = mem.search.search(query, limit = 20)
        val resolved = mutableListOf<RegisteredTool>()
        for (result in results) {
            for (line in result.entry.content.lines()) {
                val toolName = line.trim().split(" [").firstOrNull()?.trim() ?: continue
                if (toolName.isEmpty()) continue
                val tool = engine.getRegistry().find(toolName)
                if (tool != null) resolved.add(tool)
            }
        }
        resolved
    } catch (e: Exception) {
        log("[find_tools] KB search failed: ${e.message}")
        emptyList()
    }
}

/** Session-level multilingual hint state. */
private var multilingualHintShown = false

/** Return multilingual model hint if query has non-ASCII and model is English-only. */
fun getMultilingualToolHint(engine: OrchestrationEngine, query: String): String? {
    if (multilingualHintShown) return null
    if (query.all { it.code < 128 }) return null
    val active = engine.getModelManager().getActiveModel()
    if (active != "all-MiniLM-L6-v2") return null
    multilingualHintShown = true
    return "💡 Tip: Current model is English-only. For better multilingual support, run: " +
        "mem_model_manager(action='download', model_name='paraphrase-multilingual-MiniLM-L12-v2') " +
        "then mem_model_manager(action='switch', model_name='paraphrase-multilingual-MiniLM-L12-v2')"
}
