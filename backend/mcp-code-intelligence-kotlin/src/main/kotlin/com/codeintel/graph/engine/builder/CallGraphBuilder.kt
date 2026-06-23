/** Call graph builder — constructs in-memory call graph from data provider. KSA-173. */
package com.codeintel.graph.engine.builder

import com.codeintel.graph.engine.model.*
import com.codeintel.graph.engine.store.DirectedGraph
import com.codeintel.graph.engine.store.GraphIndex

class CallGraphBuilder(private val provider: ParserDataProvider) {

    fun build(): CodeGraph {
        val startTime = System.currentTimeMillis()
        val graph = DirectedGraph<GraphNode>()
        val index = GraphIndex()
        val files = provider.getAllFiles()

        // Phase 1: Add all symbol nodes
        for (file in files) {
            val nodes = provider.getSymbolNodes(file)
            for (node in nodes) {
                graph.addNode(node.id, node)
                index.index(node)
            }
        }

        // Phase 2: Add call edges
        for (file in files) {
            val edges = provider.getCallEdges(file)
            for (edge in edges) {
                resolveAndAddEdge(graph, edge)
            }
        }

        val elapsed = System.currentTimeMillis() - startTime
        return CodeGraph(
            type = GraphType.CALL_GRAPH,
            graph = graph,
            metadata = GraphMetadata(
                totalFiles = files.size,
                totalNodes = graph.nodeCount(),
                totalEdges = graph.edgeCount(),
                buildTimeMs = elapsed
            )
        )
    }

    private fun resolveAndAddEdge(graph: DirectedGraph<GraphNode>, edge: GraphEdge) {
        val targetId = resolveTarget(graph, edge.target)
        val resolved = edge.copy(target = targetId)
        graph.addEdge(resolved)
    }

    private fun resolveTarget(graph: DirectedGraph<GraphNode>, target: String): String {
        // If target already exists as a node ID, use it directly
        if (graph.containsNode(target)) return target

        // Try to find by name match (file::name pattern)
        val candidates = graph.getAllNodes().filter { it.endsWith("::$target") }
        if (candidates.size == 1) return candidates.first()

        // Unresolved — mark as external
        return "UNRESOLVED::$target"
    }
}
