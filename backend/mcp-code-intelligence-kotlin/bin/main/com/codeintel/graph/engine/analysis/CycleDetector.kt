/** Cycle detection using Tarjan's SCC algorithm. KSA-173. */
package com.codeintel.graph.engine.analysis

import com.codeintel.graph.engine.model.Cycle
import com.codeintel.graph.engine.model.CycleSeverity
import com.codeintel.graph.engine.model.GraphNode
import com.codeintel.graph.engine.store.DirectedGraph

class CycleDetector<T>(private val graph: DirectedGraph<T>) {

    fun detectCycles(scope: String? = null, minSeverity: CycleSeverity = CycleSeverity.INFO): List<Cycle> {
        val allNodes = filterByScope(scope)
        val sccs = findStronglyConnectedComponents(allNodes)
        return sccs
            .map { classifyCycle(it) }
            .filter { it.severity >= minSeverity }
            .sortedBy { it.severity.ordinal }
    }

    private fun findStronglyConnectedComponents(nodes: Set<String>): List<List<String>> {
        var index = 0
        val stack = ArrayDeque<String>()
        val indices = mutableMapOf<String, Int>()
        val lowlinks = mutableMapOf<String, Int>()
        val onStack = mutableSetOf<String>()
        val sccs = mutableListOf<List<String>>()

        fun strongConnect(node: String) {
            indices[node] = index
            lowlinks[node] = index
            index++
            stack.addLast(node)
            onStack.add(node)

            for (successor in graph.getSuccessors(node)) {
                if (successor !in nodes) continue
                if (successor !in indices) {
                    strongConnect(successor)
                    lowlinks[node] = minOf(lowlinks[node]!!, lowlinks[successor]!!)
                } else if (successor in onStack) {
                    lowlinks[node] = minOf(lowlinks[node]!!, indices[successor]!!)
                }
            }

            if (lowlinks[node] == indices[node]) {
                val scc = mutableListOf<String>()
                do {
                    val w = stack.removeLast()
                    onStack.remove(w)
                    scc.add(w)
                } while (w != node)
                if (scc.size > 1) sccs.add(scc)
            }
        }

        for (node in nodes) {
            if (node !in indices) strongConnect(node)
        }
        return sccs
    }

    private fun classifyCycle(nodes: List<String>): Cycle {
        val path = reconstructCyclePath(nodes)
        val severity = classifySeverity(nodes)
        return Cycle(nodes = nodes, path = path, severity = severity)
    }

    private fun classifySeverity(nodes: List<String>): CycleSeverity {
        val allSameFile = nodes.map { extractFile(it) }.toSet().size == 1
        return when {
            nodes.size == 2 && allSameFile -> CycleSeverity.WARNING // mutual recursion
            allSameFile -> CycleSeverity.WARNING
            else -> CycleSeverity.ERROR // circular dependency across files
        }
    }

    private fun reconstructCyclePath(nodes: List<String>): List<String> {
        if (nodes.size <= 1) return nodes
        val path = mutableListOf(nodes.first())
        val nodeSet = nodes.toSet()
        var current = nodes.first()
        val visited = mutableSetOf(current)

        repeat(nodes.size - 1) {
            val next = graph.getSuccessors(current).firstOrNull { it in nodeSet && it !in visited }
                ?: graph.getSuccessors(current).firstOrNull { it in nodeSet }
                ?: return@repeat
            path.add(next)
            visited.add(next)
            current = next
        }
        path.add(nodes.first()) // close the cycle
        return path
    }

    private fun extractFile(nodeId: String): String = nodeId.substringBefore("::")

    private fun filterByScope(scope: String?): Set<String> {
        val allNodes = graph.getAllNodes()
        if (scope == null) return allNodes
        return allNodes.filter { it.startsWith(scope) }.toSet()
    }
}
