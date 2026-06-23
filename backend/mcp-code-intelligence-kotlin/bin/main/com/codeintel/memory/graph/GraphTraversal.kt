/** Graph traversal algorithms — BFS, shortest path, ego graph. */
package com.codeintel.memory.graph

import java.util.LinkedList

object GraphTraversal {

    /** BFS from start node, returns visited nodes up to maxDepth. */
    fun bfs(adj: Map<Long, Set<Long>>, startId: Long, maxDepth: Int): List<Long> {
        val visited = mutableListOf<Long>()
        val queue = LinkedList<Pair<Long, Int>>()
        val seen = mutableSetOf(startId)
        queue.add(startId to 0)
        while (queue.isNotEmpty()) {
            val (node, depth) = queue.poll()
            visited.add(node)
            if (depth >= maxDepth) continue
            for (neighbor in adj[node] ?: emptySet()) {
                if (neighbor !in seen) {
                    seen.add(neighbor)
                    queue.add(neighbor to depth + 1)
                }
            }
        }
        return visited
    }

    /** Shortest path using BFS. Returns null if no path exists. */
    fun shortestPath(adj: Map<Long, Set<Long>>, from: Long, to: Long): List<Long>? {
        if (from == to) return listOf(from)
        val queue = LinkedList<Long>()
        val parent = mutableMapOf<Long, Long>()
        val seen = mutableSetOf(from)
        queue.add(from)
        while (queue.isNotEmpty()) {
            val node = queue.poll()
            for (neighbor in adj[node] ?: emptySet()) {
                if (neighbor in seen) continue
                parent[neighbor] = node
                if (neighbor == to) return reconstructPath(parent, from, to)
                seen.add(neighbor)
                queue.add(neighbor)
            }
        }
        return null
    }

    /** Ego graph — all nodes within radius hops (both directions). */
    fun egoGraph(
        adj: Map<Long, Set<Long>>,
        reverseAdj: Map<Long, Set<Long>>,
        nodeId: Long,
        radius: Int
    ): Set<Long> {
        val result = mutableSetOf<Long>()
        val queue = LinkedList<Pair<Long, Int>>()
        queue.add(nodeId to 0)
        result.add(nodeId)
        while (queue.isNotEmpty()) {
            val (current, depth) = queue.poll()
            if (depth >= radius) continue
            val neighbors = (adj[current] ?: emptySet()) + (reverseAdj[current] ?: emptySet())
            for (n in neighbors) {
                if (n !in result) {
                    result.add(n)
                    queue.add(n to depth + 1)
                }
            }
        }
        return result
    }

    private fun reconstructPath(parent: Map<Long, Long>, from: Long, to: Long): List<Long> {
        val path = mutableListOf(to)
        var current = to
        while (current != from) {
            current = parent[current] ?: return emptyList()
            path.add(current)
        }
        return path.reversed()
    }
}
