/** kb_search tool — hybrid search with progressive disclosure. */
package com.codeintel.memory.tools

import com.codeintel.memory.search.HybridSearch
import com.codeintel.memory.search.SearchParams
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class KbSearchTool(private val hybridSearch: HybridSearch) {

    /** Execute kb_search — returns summary by default, full content if detail=true. */
    fun execute(args: JsonObject): String {
        val query = args["query"]?.jsonPrimitive?.content ?: return "Error: query required"
        val limit = args["limit"]?.jsonPrimitive?.int ?: 10
        val tier = args["tier"]?.jsonPrimitive?.content
        val type = args["type"]?.jsonPrimitive?.content
        val role = args["role"]?.jsonPrimitive?.content
        val detail = args["detail"]?.jsonPrimitive?.boolean ?: false

        val params = SearchParams(query, limit, tier, type, role)
        val results = hybridSearch.search(params)

        if (results.isEmpty()) return "No knowledge found for \"$query\""
        val lines = mutableListOf("Found ${results.size} results:\n")
        for (r in results) {
            lines.add("[${r.entry.type}] ${r.entry.summary}")
            lines.add("  ID: ${r.entry.id} | Tier: ${r.entry.tier} | Score: ${"%.3f".format(r.score)} | Source: ${r.entry.source ?: "n/a"}")
            if (detail) lines.add("  Content: ${r.entry.content.take(500)}")
            lines.add("")
        }
        if (!detail) lines.add("Tip: use detail=true for content, or kb_get(id) for full entry.")
        return lines.joinToString("\n")
    }
}
