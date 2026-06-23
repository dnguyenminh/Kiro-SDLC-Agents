/**
 * KSA-163: Hot Path Analyzer — Finds most-called functions.
 */
package com.codeintel.analyzers.graphanalysis

import com.codeintel.analyzers.graphanalysis.utils.GraphLoader

class HotPathAnalyzer(private val graphLoader: GraphLoader) {

    fun analyze(module: String? = null, limit: Int = 20, minCallers: Int = 2): List<HotPath> {
        val reverseGraph = graphLoader.loadReverseCallGraph(module)
        val results = mutableListOf<HotPath>()

        for ((symbolId, callers) in reverseGraph) {
            if (callers.size < minCallers) continue
            val transitiveCallers = computeTransitiveCallers(symbolId, reverseGraph)
            val info = graphLoader.getSymbolInfo(symbolId) ?: continue
            results.add(HotPath(
                symbolId = symbolId, symbolName = info.name,
                filePath = info.filePath, directCallers = callers.size,
                transitiveCallers = transitiveCallers, kind = info.kind,
            ))
        }
        return results.sortedByDescending { it.transitiveCallers }.take(limit)
    }

    private fun computeTransitiveCallers(symbolId: Int, reverseGraph: AdjacencyList): Int {
        val visited = mutableSetOf(symbolId)
        val queue = ArrayDeque<Int>()
        queue.addLast(symbolId)
        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            for (caller in reverseGraph[current] ?: emptyList()) {
                if (caller !in visited) {
                    visited.add(caller); queue.addLast(caller)
                }
            }
        }
        return visited.size - 1
    }
}
