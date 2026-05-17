/** kb_graph tool — query and manipulate knowledge graph. */
package com.codeintel.memory.tools

import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.models.GraphEdge
import com.codeintel.memory.repository.KnowledgeRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.long
import kotlinx.serialization.json.jsonPrimitive

class KbGraphTool(
    private val graph: KnowledgeGraph,
    private val knowledgeRepo: KnowledgeRepository
) {

    /** Execute kb_graph with given arguments. */
    fun execute(args: JsonObject): String {
        val action = args["action"]?.jsonPrimitive?.content ?: "neighbors"
        return when (action) {
            "neighbors" -> handleNeighbors(args)
            "add_edge" -> handleAddEdge(args)
            "path" -> handlePath(args)
            "ego" -> handleEgo(args)
            else -> "Unknown action: $action"
        }
    }

    private fun handleNeighbors(args: JsonObject): String {
        val nodeId = args["node_id"]?.jsonPrimitive?.long ?: return "Error: node_id required"
        val neighbors = graph.getConnected(nodeId)
        if (neighbors.isEmpty()) return "Node $nodeId has no connections"
        val lines = mutableListOf("Node $nodeId connections (${neighbors.size}):\n")
        for (nId in neighbors.take(20)) {
            val entry = knowledgeRepo.findById(nId)
            lines.add("  → [$nId] ${entry?.summary ?: "unknown"}")
        }
        return lines.joinToString("\n")
    }

    private fun handleAddEdge(args: JsonObject): String {
        val sourceId = args["source_id"]?.jsonPrimitive?.long ?: return "Error: source_id required"
        val targetId = args["target_id"]?.jsonPrimitive?.long ?: return "Error: target_id required"
        val relation = args["relation"]?.jsonPrimitive?.content ?: "RELATES_TO"
        val edge = GraphEdge(sourceId = sourceId, targetId = targetId, relation = relation)
        val id = graph.addEdge(edge)
        return "Edge created: $sourceId --[$relation]--> $targetId (id=$id)"
    }

    private fun handlePath(args: JsonObject): String {
        val fromId = args["from_id"]?.jsonPrimitive?.long ?: return "Error: from_id required"
        val toId = args["to_id"]?.jsonPrimitive?.long ?: return "Error: to_id required"
        val path = graph.shortestPath(fromId, toId) ?: return "No path found between $fromId and $toId"
        return "Path: ${path.joinToString(" → ")}"
    }

    private fun handleEgo(args: JsonObject): String {
        val nodeId = args["node_id"]?.jsonPrimitive?.long ?: return "Error: node_id required"
        val radius = args["radius"]?.jsonPrimitive?.int ?: 2
        val nodes = graph.egoGraph(nodeId, radius)
        return "Ego graph for $nodeId (radius=$radius): ${nodes.size} nodes\n${nodes.joinToString(", ")}"
    }
}
