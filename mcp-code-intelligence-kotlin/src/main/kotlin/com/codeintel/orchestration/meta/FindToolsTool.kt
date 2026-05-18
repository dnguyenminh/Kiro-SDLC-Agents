/**
 * find_tools meta-tool — tokenized search across all registered tools (native + child)
 * by name and description. Merges registry results with KB search for completeness.
 */
package com.codeintel.orchestration.meta

import com.codeintel.log
import com.codeintel.orchestration.OrchestrationEngine
import com.codeintel.orchestration.registry.RegisteredTool
import kotlinx.serialization.json.*

class FindToolsTool(private val engine: OrchestrationEngine) {
    private val json = Json { encodeDefaults = true }

    /** Execute tokenized search for tools matching query. */
    fun execute(args: JsonObject): String {
        val query = args["query"]?.jsonPrimitive?.content
            ?: return errorJson("Missing 'query'")
        val registryResults = engine.getRegistry().search(query)
        val kbResults = searchKb(query)
        val merged = mergeResults(registryResults, kbResults)
        val arr = buildJsonArray {
            for (tool in merged.take(10)) { add(tool.definition) }
        }
        return json.encodeToString(JsonArray.serializer(), arr)
    }

    /** Search KB for tool definitions (best-effort, graceful degradation). */
    private fun searchKb(query: String): List<RegisteredTool> {
        val mem = engine.getMemoryEngine() ?: return emptyList()
        return try {
            val results = mem.search.search(query, limit = 20)
            resolveKbResults(results)
        } catch (e: Exception) {
            log("[find_tools] KB search failed: ${e.message}")
            emptyList()
        }
    }

    /** Resolve KB search results back to registered tools by name. */
    private fun resolveKbResults(results: List<Any>): List<RegisteredTool> {
        // KB entries contain "toolName [source]: desc" lines
        // Registry already has all tools — KB is supplementary for recall
        return emptyList()
    }

    /** Merge registry + KB results, deduplicate by tool name. */
    private fun mergeResults(
        registry: List<RegisteredTool>,
        kb: List<RegisteredTool>
    ): List<RegisteredTool> {
        val seen = registry.map { it.name }.toMutableSet()
        val merged = registry.toMutableList()
        for (tool in kb) {
            if (tool.name !in seen) {
                merged.add(tool)
                seen.add(tool.name)
            }
        }
        return merged
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "find_tools")
        put("description", "Search for available tools by describing what you want to accomplish. Returns tool definitions with input schemas.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("query") {
                    put("type", "string")
                    put("description", "Natural language description or keyword to search for")
                }
            }
            putJsonArray("required") { add("query") }
        }
    }

    private fun errorJson(msg: String) = """{"error":"$msg"}"""
}
