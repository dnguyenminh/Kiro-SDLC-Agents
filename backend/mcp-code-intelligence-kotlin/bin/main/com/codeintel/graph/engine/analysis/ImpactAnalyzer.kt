/** Impact analysis — BFS-based change propagation. KSA-173. */
package com.codeintel.graph.engine.analysis

import com.codeintel.graph.engine.model.AffectedNode
import com.codeintel.graph.engine.model.ImpactResult
import com.codeintel.graph.engine.store.DirectedGraph
import java.util.LinkedList

class ImpactAnalyzer<T>(private val graph: DirectedGraph<T>) {

    fun analyze(target: String, maxDepth: Int = Int.MAX_VALUE): ImpactResult {
        if (!graph.containsNode(target)) return ImpactResult(target = target)

        val visited = mutableSetOf<String>()
        val queue: LinkedList<Pair<String, Int>> = LinkedList()
        val affected = mutableListOf<AffectedNode>()

        queue.add(target to 0)
        visited.add(target)

        while (queue.isNotEmpty()) {
            val (current, depth) = queue.poll()
            if (depth >= maxDepth) continue

            val predecessors = graph.getPredecessors(current)
            for (pred in predecessors) {
                if (pred in visited) continue
                visited.add(pred)
                val score = calculateScore(pred, depth + 1)
                affected.add(AffectedNode(pred, depth + 1, score))
                queue.add(pred to (depth + 1))
            }
        }

        val sorted = affected.sortedByDescending { it.score }
        return ImpactResult(
            target = target,
            totalAffected = sorted.size,
            directDependents = sorted.count { it.distance == 1 },
            affected = sorted
        )
    }

    private fun calculateScore(node: String, distance: Int): Double {
        val distanceFactor = 1.0 / distance
        val fanOut = graph.getSuccessors(node).size
        val fanOutFactor = minOf(1.0, fanOut / 10.0)
        return distanceFactor * 0.7 + fanOutFactor * 0.3
    }
}
