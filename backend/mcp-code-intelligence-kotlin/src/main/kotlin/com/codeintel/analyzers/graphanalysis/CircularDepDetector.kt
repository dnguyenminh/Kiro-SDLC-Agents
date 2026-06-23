/**
 * KSA-163: Circular Dependency Detector using Tarjan's SCC.
 */
package com.codeintel.analyzers.graphanalysis

import com.codeintel.analyzers.graphanalysis.utils.GraphLoader
import com.codeintel.analyzers.graphanalysis.utils.TarjanSCC

class CircularDepDetector(private val graphLoader: GraphLoader) {

    fun detect(options: CircularDepOptions = CircularDepOptions()): List<CircularDep> {
        val graph = graphLoader.loadDependencyGraph(options.module)
        if (graph.isEmpty()) return emptyList()

        val tarjan = TarjanSCC()
        val sccs = tarjan.findSCCs(graph)

        return sccs
            .filter { options.maxLength == null || it.size <= options.maxLength }
            .map { scc -> buildCircularDep(scc, graph, options.module) }
            .sortedWith(compareBy({ severityOrder(it.severity) }, { it.length }))
    }

    private fun buildCircularDep(scc: List<Int>, graph: AdjacencyList, module: String?): CircularDep {
        val infos = graphLoader.getSymbolInfoBatch(scc)
        val sccSet = scc.toSet()
        val ordered = orderCycle(scc, graph, sccSet)
        val nodes = ordered.map { id ->
            val info = infos[id]
            CycleNode(id, info?.name ?: "symbol_$id", info?.filePath ?: "unknown", info?.kind ?: "unknown")
        }
        val edges = ordered.indices.map { i ->
            val curr = infos[ordered[i]]?.name ?: "${ordered[i]}"
            val next = infos[ordered[(i + 1) % ordered.size]]?.name ?: "${ordered[(i + 1) % ordered.size]}"
            "$curr → $next"
        }
        return CircularDep(CycleChain(nodes, edges), scc.size, classifySeverity(scc.size), module)
    }

    private fun orderCycle(scc: List<Int>, graph: AdjacencyList, sccSet: Set<Int>): List<Int> {
        val visited = mutableSetOf<Int>()
        val ordered = mutableListOf<Int>()
        var current = scc[0]
        while (current !in visited) {
            visited.add(current); ordered.add(current)
            val next = graph[current]?.firstOrNull { it in sccSet && it !in visited }
            current = next ?: break
        }
        return if (ordered.size == scc.size) ordered else scc
    }

    private fun classifySeverity(length: Int): String = when {
        length <= 2 -> "high"; length <= 4 -> "medium"; else -> "low"
    }

    private fun severityOrder(s: String): Int = when (s) {
        "high" -> 0; "medium" -> 1; else -> 2
    }
}

data class CircularDepOptions(val module: String? = null, val maxLength: Int? = null)
