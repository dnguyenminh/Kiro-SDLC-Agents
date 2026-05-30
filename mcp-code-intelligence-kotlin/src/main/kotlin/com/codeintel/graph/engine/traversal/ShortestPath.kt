/** BFS-based shortest path between two nodes. KSA-173. */
package com.codeintel.graph.engine.traversal

import com.codeintel.graph.engine.model.Direction
import com.codeintel.graph.engine.store.DirectedGraph
import java.util.LinkedList

class ShortestPath<T>(private val graph: DirectedGraph<T>) {

    fun find(from: String, to: String, direction: Direction = Direction.FORWARD): List<String>? {
        if (!graph.containsNode(from) || !graph.containsNode(to)) return null
        if (from == to) return listOf(from)

        val visited = mutableSetOf<String>()
        val parent = mutableMapOf<String, String>()
        val queue: LinkedList<String> = LinkedList()

        queue.add(from)
        visited.add(from)

        while (queue.isNotEmpty()) {
            val current = queue.poll()
            val neighbors = getNeighbors(current, direction)

            for (neighbor in neighbors) {
                if (neighbor in visited) continue
                visited.add(neighbor)
                parent[neighbor] = current

                if (neighbor == to) return reconstructPath(from, to, parent)
                queue.add(neighbor)
            }
        }

        return null // No path found
    }

    private fun reconstructPath(from: String, to: String, parent: Map<String, String>): List<String> {
        val path = mutableListOf(to)
        var current = to
        while (current != from) {
            current = parent[current] ?: break
            path.add(0, current)
        }
        return path
    }

    private fun getNeighbors(nodeId: String, direction: Direction): List<String> {
        return when (direction) {
            Direction.FORWARD -> graph.getSuccessors(nodeId)
            Direction.REVERSE -> graph.getPredecessors(nodeId)
            Direction.BOTH -> graph.getSuccessors(nodeId) + graph.getPredecessors(nodeId)
        }
    }
}
