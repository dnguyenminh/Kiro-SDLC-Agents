/** BFS traversal on DirectedGraph. KSA-173. */
package com.codeintel.graph.engine.traversal

import com.codeintel.graph.engine.model.*
import com.codeintel.graph.engine.store.DirectedGraph
import java.util.LinkedList

class BfsTraversal<T>(private val graph: DirectedGraph<T>) {

    fun traverse(
        start: String,
        direction: Direction = Direction.FORWARD,
        maxDepth: Int = Int.MAX_VALUE,
        filter: TraversalFilter? = null
    ): TraversalResult {
        if (!graph.containsNode(start)) return TraversalResult(start, "bfs", direction)

        val visited = mutableSetOf<String>()
        val queue: LinkedList<Pair<String, Int>> = LinkedList()
        val results = mutableListOf<TraversalNode>()

        queue.add(start to 0)
        visited.add(start)

        while (queue.isNotEmpty()) {
            val (current, depth) = queue.poll()
            results.add(TraversalNode(current, depth))

            if (depth >= maxDepth) continue

            val neighbors = getNeighbors(current, direction)
            for (neighbor in neighbors) {
                if (neighbor in visited) continue
                if (!matchesFilter(neighbor, filter)) continue
                visited.add(neighbor)
                queue.add(neighbor to (depth + 1))
            }
        }

        return TraversalResult(start, "bfs", direction, results)
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
