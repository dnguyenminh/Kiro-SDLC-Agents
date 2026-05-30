/**
 * KSA-163: Tarjan's Strongly Connected Components algorithm.
 */
package com.codeintel.analyzers.graphanalysis.utils

import com.codeintel.analyzers.graphanalysis.AdjacencyList

class TarjanSCC {
    private var index = 0
    private val stack = ArrayDeque<Int>()
    private val indices = mutableMapOf<Int, Int>()
    private val lowlinks = mutableMapOf<Int, Int>()
    private val onStack = mutableSetOf<Int>()
    private val sccs = mutableListOf<List<Int>>()

    fun findSCCs(graph: AdjacencyList): List<List<Int>> {
        reset()
        for (node in graph.keys) {
            if (node !in indices) strongConnect(node, graph)
        }
        return sccs.filter { it.size > 1 }
    }

    private fun strongConnect(v: Int, graph: AdjacencyList) {
        indices[v] = index
        lowlinks[v] = index
        index++
        stack.addLast(v)
        onStack.add(v)

        for (w in graph[v] ?: emptyList()) {
            if (w !in indices) {
                strongConnect(w, graph)
                lowlinks[v] = minOf(lowlinks[v]!!, lowlinks[w]!!)
            } else if (w in onStack) {
                lowlinks[v] = minOf(lowlinks[v]!!, indices[w]!!)
            }
        }

        if (lowlinks[v] == indices[v]) {
            val scc = mutableListOf<Int>()
            do {
                val w = stack.removeLast()
                onStack.remove(w)
                scc.add(w)
            } while (w != v)
            sccs.add(scc)
        }
    }

    private fun reset() {
        index = 0; stack.clear(); indices.clear()
        lowlinks.clear(); onStack.clear(); sccs.clear()
    }
}
