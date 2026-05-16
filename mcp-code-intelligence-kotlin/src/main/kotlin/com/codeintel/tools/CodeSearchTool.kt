/** code_search tool — full-text search across indexed symbols. */
package com.codeintel.tools

import com.codeintel.query.QueryLayer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class CodeSearchTool(private val queryLayer: QueryLayer) {

    /** Execute code_search with given arguments. */
    fun execute(args: JsonObject): String {
        val query = args["query"]?.jsonPrimitive?.content ?: ""
        val limit = args["limit"]?.jsonPrimitive?.int ?: 20
        val results = queryLayer.searchCode(query, limit)
        return formatResults(results, query)
    }

    private fun formatResults(results: List<com.codeintel.query.SearchResult>, query: String): String {
        if (results.isEmpty()) return "No results found for \"$query\""
        val lines = mutableListOf("Found ${results.size} results for \"$query\":\n")
        for (r in results) {
            lines.add("[${r.kind}] ${r.name}")
            lines.add("  File: ${r.filePath}:${r.startLine}")
            r.signature?.let { lines.add("  Sig: ${it.take(120)}") }
            r.docComment?.let { lines.add("  Doc: ${it.take(100)}") }
            lines.add("")
        }
        return lines.joinToString("\n")
    }
}
