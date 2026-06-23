/** code_callees tool — find all functions/methods called by a symbol. KSA-171. */
package com.codeintel.tools

import com.codeintel.graph.CallGraphService
import com.codeintel.graph.models.CallGraphResponse
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class CodeCalleesTool(private val callGraph: CallGraphService) {

    fun execute(args: JsonObject): String {
        val symbol = args["symbol"]?.jsonPrimitive?.content
            ?: return """{"error":"Parameter \"symbol\" is required"}"""
        val depth = args["depth"]?.jsonPrimitive?.int ?: 1
        val limit = args["limit"]?.jsonPrimitive?.int ?: 20
        val fileFilter = args["file_filter"]?.jsonPrimitive?.content
        val includeExternal = args["include_external"]?.jsonPrimitive?.boolean ?: true

        val result = callGraph.findCallees(symbol, depth, limit, fileFilter, includeExternal)
        return formatResult(result)
    }

    private fun formatResult(result: CallGraphResponse): String {
        if (result.results.isEmpty() && result.resolvedTo.isEmpty()) {
            return "Symbol \"${result.symbol}\" not found in index."
        }
        if (result.results.isEmpty()) {
            return "No callees found for \"${result.symbol}\" (resolved to ${result.resolvedTo.size} definition(s))"
        }

        val lines = mutableListOf<String>()
        lines.add("Callees of \"${result.symbol}\" (depth ${result.metadata.depthSearched}):\n")

        if (result.resolvedTo.isNotEmpty()) {
            lines.add("Resolved to:")
            for (r in result.resolvedTo) lines.add("  [${r.kind}] ${r.file}:${r.line}")
            lines.add("")
        }

        for (item in result.results) {
            val prefix = "  ".repeat(item.depthLevel)
            lines.add("$prefix[${item.kind}] ${item.qualifiedName}")
            lines.add("$prefix  ${item.filePath}:${item.callSiteLine} (def: L${item.definitionLine})")
        }

        val m = result.metadata
        lines.add("\n--- ${m.totalCount} results | ${m.queryTimeMs}ms${if (m.truncated) " | TRUNCATED" else ""}")
        return lines.joinToString("\n")
    }
}
