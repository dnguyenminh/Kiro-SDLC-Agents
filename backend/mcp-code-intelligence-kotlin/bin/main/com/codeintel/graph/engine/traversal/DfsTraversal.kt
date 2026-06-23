/** DFS traversal on DirectedGraph. KSA-173. */
package com.codeintel.graph.engine.traversal

import com.codeintel.graph.engine.model.*
import com.codeintel.graph.engine.store.DirectedGraph

class DfsTraversal<T>(private val graph: DirectedGraph<T>) {

    fun traverse(
        start: String,
        direction: Direction = Direction.FORWARD,
        maxDepth: Int = Int.MAX_VALUE,
        filter: TraversalFilter? = null
    ): TraversalResult {
        if (!graph.containsNode(start)) return TraversalResult(start, "dfs", direction)

        val visited = mutableSetOf<String>()
        val results = mutableListOf<TraversalNode>()
        dfs(start, 0, maxDepth, direction, filter, visited, results)
        return TraversalResult(start, "dfs", direction, results)
    }

    private fun dfs(
        node: String,
        depth: Int,
        maxDepth: Int,
        direction: Direction,
        filter: TraversalFilter?,
        visited: MutableSet<String>,
        results: MutableList<TraversalNode>
    ) {
        if (node in visited) return
        visited.add(node)
        results.add(TraversalNode(node, depth))

        if (depth >= maxDepth) return

        val neighbors = getNeighbors(node, direction)
        for (neighbor in neighbors) {
            if (neighbor in visited) continue
            if (!matchesFilter(neighbor, filter)) continue
            dfs(neighbor, depth + 1, maxDepth, direction, filter, visited, results)
        }
    }

    private fun getNeighbors(nodeId: String, direction: Direction): List<String> {
        return when (direction) {
            Direction.FORWARD -> graph.getSuccessors(nodeId)
            Direction.REVERSE -> graph.getPredecessors(nodeId)
            Direction.BOTH -> graph.getSuccessors(nodeId) + graph.getPredecessors(nodeId)
        }
    }

    private fun matchesFilter(nodeId: String, filter: TraversalFilter?): Boolean {
        if (filter == null) return true
        val node = graph.getNode(nodeId) as? GraphNode
        return filter.matches(nodeId, node)
    }
}
