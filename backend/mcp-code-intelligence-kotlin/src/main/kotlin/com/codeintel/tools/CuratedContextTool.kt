/** get_curated_context tool — NL query across codebase with RRF merge. KSA-171. */
package com.codeintel.tools

import com.codeintel.context.CuratedContextService
import com.codeintel.context.models.CuratedContextParams
import com.codeintel.context.models.CuratedContextResponse
import com.codeintel.context.models.SourceWeights
import kotlinx.serialization.json.*

class CuratedContextTool(private val curatedService: CuratedContextService) {

    fun execute(args: JsonObject): String {
        val query = args["query"]?.jsonPrimitive?.content
            ?: return """{"error":"Parameter \"query\" is required"}"""

        val maxTokens = args["max_tokens"]?.jsonPrimitive?.int ?: 4000
        val includeSource = args["include_source"]?.jsonPrimitive?.boolean ?: true
        val includeMemory = args["include_memory"]?.jsonPrimitive?.boolean ?: true
        val includeGraph = args["include_graph"]?.jsonPrimitive?.boolean ?: true
        val sourceWeights = parseWeights(args["source_weights"]?.jsonObject)

        val params = CuratedContextParams(
            query = query,
            maxTokens = maxTokens,
            includeSource = includeSource,
            includeMemory = includeMemory,
            includeGraph = includeGraph,
            sourceWeights = sourceWeights,
        )

        val result = curatedService.getContext(params)
        return formatResult(result)
    }

    private fun parseWeights(obj: JsonObject?): SourceWeights? {
        obj ?: return null
        return SourceWeights(
            code = obj["code"]?.jsonPrimitive?.double ?: 0.5,
            memory = obj["memory"]?.jsonPrimitive?.double ?: 0.3,
            graph = obj["graph"]?.jsonPrimitive?.double ?: 0.2,
        )
    }

    private fun formatResult(result: CuratedContextResponse): String {
        val lines = mutableListOf<String>()
        lines.add("Curated Context: \"${result.query}\"\n")

        for (section in result.sections) {
            lines.add("--- ${section.title} (${section.source}) ---")
            for (item in section.items.take(10)) {
                val loc = if (item.file != null) " @ ${item.file}:${item.line ?: 0}" else ""
                lines.add("  [${item.kind ?: "ref"}] ${item.name}$loc")
                if (item.content.isNotBlank()) {
                    lines.add("    ${item.content.take(200)}")
                }
            }
            lines.add("")
        }

        val m = result.metadata
        lines.add("Tokens: ${m.tokensUsed}/${m.tokensBudget} | ${m.executionTimeMs}ms")
        lines.add("Sources: ${m.sourcesQueried.joinToString(", ")} | ${m.totalCandidates} candidates -> ${m.resultsReturned} returned")
        return lines.joinToString("\n")
    }
}
