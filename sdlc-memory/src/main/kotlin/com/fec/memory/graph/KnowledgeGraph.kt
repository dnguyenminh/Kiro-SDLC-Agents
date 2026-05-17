package com.fec.memory.graph

import mu.KotlinLogging
import org.jgrapht.graph.DefaultDirectedWeightedGraph
import org.jgrapht.graph.DefaultWeightedEdge

private val logger = KotlinLogging.logger {}

/**
 * In-memory knowledge graph using JGraphT.
 * Nodes = memory IDs, edges = relations with weights.
 */
class KnowledgeGraph {
    private val graph = DefaultDirectedWeightedGraph<Long, RelationEdge>(RelationEdge::class.java)

    fun addNode(memoryId: Long) {
        if (!graph.containsVertex(memoryId)) {
            graph.addVertex(memoryId)
        }
    }

    fun addEdge(sourceId: Long, targetId: Long, relation: String, weight: Double = 1.0) {
        addNode(sourceId)
        addNode(targetId)
        val edge = RelationEdge(relation)
        graph.addEdge(sourceId, targetId, edge)
        graph.setEdgeWeight(edge, weight)
    }

    fun getNeighbors(memoryId: Long, maxDepth: Int = 2): Set<Long> {
        if (!graph.containsVertex(memoryId)) return emptySet()
        val visited = mutableSetOf<Long>()
        val queue = ArrayDeque<Pair<Long, Int>>()
        queue.add(memoryId to 0)
        while (queue.isNotEmpty()) {
            val (current, depth) = queue.removeFirst()
            if (depth > maxDepth || current in visited) continue
            visited.add(current)
            graph.outgoingEdgesOf(current).forEach { edge ->
                queue.add(graph.getEdgeTarget(edge) to depth + 1)
            }
            graph.incomingEdgesOf(current).forEach { edge ->
                queue.add(graph.getEdgeSource(edge) to depth + 1)
            }
        }
        visited.remove(memoryId)
        return visited
    }

    fun getRelations(memoryId: Long): List<GraphRelation> {
        if (!graph.containsVertex(memoryId)) return emptyList()
        val relations = mutableListOf<GraphRelation>()
        graph.outgoingEdgesOf(memoryId).forEach { edge ->
            relations.add(GraphRelation(
                sourceId = memoryId,
                targetId = graph.getEdgeTarget(edge),
                relation = edge.relation,
                weight = graph.getEdgeWeight(edge)
            ))
        }
        return relations
    }

    fun nodeCount(): Int = graph.vertexSet().size
    fun edgeCount(): Int = graph.edgeSet().size
}

class RelationEdge(val relation: String) : DefaultWeightedEdge()

data class GraphRelation(
    val sourceId: Long,
    val targetId: Long,
    val relation: String,
    val weight: Double,
)
