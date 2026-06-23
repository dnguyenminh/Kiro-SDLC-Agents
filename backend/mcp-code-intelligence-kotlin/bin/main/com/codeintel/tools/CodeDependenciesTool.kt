/** code_dependencies tool — file/module import dependency analysis. KSA-171. */
package com.codeintel.tools

import com.codeintel.graph.DependencyGraphService
import com.codeintel.graph.models.DependencyResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class CodeDependenciesTool(private val depGraph: DependencyGraphService) {

    fun execute(args: JsonObject): String {
        val file = args["file"]?.jsonPrimitive?.content
            ?: return """{"error":"Parameter \"file\" is required"}"""

        val direction = args["direction"]?.jsonPrimitive?.content ?: "outgoing"
        val depth = args["depth"]?.jsonPrimitive?.int ?: 1
        val includeExternal = args["include_external"]?.jsonPrimitive?.boolean ?: false
        val format = args["format"]?.jsonPrimitive?.content ?: "tree"
        val limit = args["limit"]?.jsonPrimitive?.int ?: 50

        val result = depGraph.query(file, direction, depth, includeExternal, limit)
        return formatResult(result, format)
    }

    private fun formatResult(result: DependencyResult, format: String): String {
        if (result.results.isEmpty()) {
            return "No ${result.direction} dependencies found for \"${result.root}\""
        }

        return when (format) {
            "flat" -> formatFlat(result)
            "graph" -> formatGraph(result)
            else -> formatTree(result)
        }
    }

    private fun formatTree(result: DependencyResult): String {
        val lines = mutableListOf<String>()
        lines.add("Dependencies of \"${result.root}\" (${result.direction}):\n")

        for (node in result.results) {
            val prefix = "  ".repeat(node.depth)
            val ext = if (node.isExternal) " [external]" else ""
            val symbols = if (node.importedSymbols.isNotEmpty()) " {${node.importedSymbols.joinToString(", ")}}" else ""
            lines.add("$prefix├── ${node.file}$ext$symbols")
        }

        if (result.cycles.isNotEmpty()) {
            lines.add("\nCycles detected:")
            for (cycle in result.cycles.take(5)) lines.add("  ${cycle.joinToString(" -> ")}")
        }

        val m = result.metadata
        lines.add("\n--- ${m.totalNodes} nodes | depth ${m.maxDepthReached} | ${m.queryTimeMs}ms${if (m.truncated) " | TRUNCATED" else ""}")
        return lines.joinToString("\n")
    }

    private fun formatFlat(result: DependencyResult): String {
        val lines = mutableListOf("Dependencies (flat) for \"${result.root}\":\n")
        for (node in result.results) {
            val ext = if (node.isExternal) " [ext]" else ""
            lines.add("  ${node.file}$ext (depth ${node.depth})")
        }
        lines.add("\n--- ${result.metadata.totalNodes} total")
        return lines.joinToString("\n")
    }

    private fun formatGraph(result: DependencyResult): String {
        val lines = mutableListOf("Dependency graph for \"${result.root}\":\n")
        lines.add("  ${result.root}")
        for (node in result.results) {
            lines.add("    -> ${node.file}")
        }
        if (result.cycles.isNotEmpty()) {
            lines.add("\n  Cycles: ${result.cycles.size}")
        }
        return lines.joinToString("\n")
    }
}
