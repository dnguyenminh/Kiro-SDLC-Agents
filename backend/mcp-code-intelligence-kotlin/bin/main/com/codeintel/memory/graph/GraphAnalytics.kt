/** Graph analytics — centrality, clustering, community detection. */
package com.codeintel.memory.graph

/** Basic graph analytics for knowledge graph insights. */
object GraphAnalytics {

    /** Degree centrality — normalized count of connections per node. */
    fun degreeCentrality(adj: Map<Long, Set<Long>>): Map<Long, Double> {
        if (adj.isEmpty()) return emptyMap()
        val maxDegree = adj.values.maxOf { it.size }.toDouble()
        if (maxDegree == 0.0) return adj.keys.associateWith { 0.0 }
        return adj.mapValues { (_, neighbors) -> neighbors.size / maxDegree }
    }

    /** Find hub nodes — nodes with degree above threshold. */
    fun findHubs(adj: Map<Long, Set<Long>>, minDegree: Int = 3): List<Long> {
        return adj.filter { it.value.size >= minDegree }.keys.toList()
    }

    /** Find isolated nodes — nodes with no connections. */
    fun findIsolated(adj: Map<Long, Set<Long>>): List<Long> {
        return adj.filter { it.value.isEmpty() }.keys.toList()
    }

    /** Connected components using union-find approach. */
    fun connectedComponents(adj: Map<Long, Set<Long>>): List<Set<Long>> {
        val visited = mutableSetOf<Long>()
        val components = mutableListOf<Set<Long>>()
        for (node in adj.keys) {
            if (node in visited) continue
            val component = mutableSetOf<Long>()
            val queue = ArrayDeque<Long>()
            queue.add(node)
            while (queue.isNotEmpty()) {
                val current = queue.removeFirst()
                if (current in visited) continue
                visited.add(current)
                component.add(current)
                for (neighbor in adj[current] ?: emptySet()) {
                    if (neighbor !in visited) queue.add(neighbor)
                }
            }
            components.add(component)
        }
        return components
    }

    /** Graph density — ratio of actual edges to possible edges. */
    fun density(nodeCount: Int, edgeCount: Int): Double {
        if (nodeCount <= 1) return 0.0
        val maxEdges = nodeCount.toLong() * (nodeCount - 1)
        return edgeCount.toDouble() / maxEdges
    }
}
