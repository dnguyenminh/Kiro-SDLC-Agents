/** code_traverse tool — generic graph traversal with edge/node type filters. KSA-171. */
package com.codeintel.tools

import com.codeintel.graph.GraphTraverser
import com.codeintel.graph.models.TraverseConfig
import kotlinx.serialization.json.*

class CodeTraverseTool(private val traverser: GraphTraverser) {

    fun execute(args: JsonObject): String {
        val start = args["start"]?.jsonPrimitive?.content
            ?: return """{"error":"Parameter \"start\" is required"}"""

        val edgeTypes = args["edge_types"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList()
        val nodeTypes = args["node_types"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList()
        val direction = args["direction"]?.jsonPrimitive?.content ?: "outgoing"
        val maxDepth = (args["max_depth"]?.jsonPrimitive?.int ?: 3).coerceIn(1, 10)
        val maxResults = (args["max_results"]?.jsonPrimitive?.int ?: 50).coerceAtMost(200)
        val includeSource = args["include_source"]?.jsonPrimitive?.boolean ?: false
        val sourceLines = args["source_lines"]?.jsonPrimitive?.int ?: 5

        val startNode = traverser.resolveNode(start)
            ?: return "Symbol \"$start\" not found in index."

        val config = TraverseConfig(
            edgeTypes = edgeTypes,
            nodeTypes = nodeTypes,
            direction = direction,
            maxDepth = maxDepth,
            maxResults = maxResults,
        )

        val startTime = System.currentTimeMillis()
        val results = traverser.traverse(startNode, config)
        val elapsed = System.currentTimeMillis() - startTime

        val response = traverser.formatResponse(startNode, results, includeSource, sourceLines, elapsed)
        return formatOutput(response, start)
    }

    private fun formatOutput(response: com.codeintel.graph.models.TraverseResponse, start: String): String {
        val lines = mutableListOf<String>()
        val s = response.start
        lines.add("Traversal from \"$start\" [${s["kind"]}] ${s["file"]}:${s["line"]}\n")

        for (r in response.results) {
            val depth = r["depth"] as? Int ?: 0
            val prefix = "  ".repeat(depth)
            lines.add("$prefix[${r["edge_type"]}] ${r["name"]} (${r["kind"]})")
            lines.add("$prefix  ${r["file"]}:${r["line"]}")
            (r["source"] as? String)?.let { lines.add("$prefix  >>> $it") }
        }

        val m = response.metadata
        lines.add("\n--- ${m["total_results"]} results | depth ${m["max_depth_reached"]} | ${m["execution_time_ms"]}ms${if (m["truncated"] == true) " | TRUNCATED" else ""}")
        return lines.joinToString("\n")
    }
}
