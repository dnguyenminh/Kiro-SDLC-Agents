/** Hot path analysis — centrality metrics. KSA-173. */
package com.codeintel.graph.engine.analysis

import com.codeintel.graph.engine.model.HotPathResult
import com.codeintel.graph.engine.store.DirectedGraph

class HotPathAnalyzer<T>(private val graph: DirectedGraph<T>) {

    fun analyze(topN: Int = 10, scope: String? = null): List<HotPathResult> {
        val nodes = filterByScope(scope)
        if (nodes.isEmpty()) return emptyList()

        return nodes.map { node -> computeMetrics(node, nodes) }
            .sortedByDescending { it.compositeScore }
            .take(topN)
    }

    private fun computeMetrics(node: String, allNodes: List<String>): HotPathResult {
        val inDegree = graph.getPredecessors(node).size
        val outDegree = graph.getSuccessors(node).size
        val betweenness = estimateBetweenness(node, allNodes)
        val normalizer = maxOf(1.0, allNodes.size.toDouble() / 10)
        val compositeScore = (inDegree * 0.4 + outDegree * 0.2 + betweenness * 100 * 0.4) / normalizer

        return HotPathResult(
            node = node,
            inDegree = inDegree,
            outDegree = outDegree,
            betweenness = betweenness,
            compositeScore = compositeScore,
            classification = classify(inDegree, outDegree)
        )
    }

    private fun estimateBetweenness(node: String, allNodes: List<String>): Double {
        val sample = allNodes.take(BETWEENNESS_SAMPLE_SIZE)
        var pathsThrough = 0
        var totalPaths = 0

        for (source in sample) {
            if (source == node) continue
            for (target in sample) {
                if (target == source || target == node) continue
                totalPaths++
                if (isOnShortestPath(source, target, node)) pathsThrough++
            }
        }

        return if (totalPaths > 0) pathsThrough.toDouble() / totalPaths else 0.0
    }

    private fun isOnShortestPath(source: String, target: String, through: String): Boolean {
        val distSourceThrough = bfsDistance(source, through) ?: return false
        val distThroughTarget = bfsDistance(through, target) ?: return false
        val distDirect = bfsDistance(source, target) ?: return false
        return distSourceThrough + distThroughTarget == distDirect
    }

    private fun bfsDistance(from: String, to: String): Int? {
        if (from == to) return 0
        val visited = mutableSetOf(from)
        val queue = ArrayDeque<Pair<String, Int>>()
        queue.add(from to 0)

        while (queue.isNotEmpty()) {
            val (current, depth) = queue.removeFirst()
            if (depth > MAX_BFS_DEPTH) return null
            for (neighbor in graph.getSuccessors(current)) {
                if (neighbor == to) return depth + 1
                if (neighbor !in visited) {
                    visited.add(neighbor)
                    queue.add(neighbor to (depth + 1))
                }
            }
        }
        return null
    }

    private fun classify(inDegree: Int, outDegree: Int): String = when {
        inDegree > 20 && outDegree < 5 -> "utility_hub"
        inDegree > 10 && outDegree > 10 -> "service_hub"
        outDegree > 20 && inDegree < 5 -> "orchestrator"
        else -> "normal"
    }

    private fun filterByScope(scope: String?): List<String> {
        val allNodes = graph.getAllNodes()
        if (scope == null) return allNodes.toList()
        return allNodes.filter { it.startsWith(scope) }
    }

    companion object {
        private const val BETWEENNESS_SAMPLE_SIZE = 50
        private const val MAX_BFS_DEPTH = 10
    }
}
