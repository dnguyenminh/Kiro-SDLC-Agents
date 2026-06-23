/**
 * KSA-163: Related Test Finder — Reverse BFS on call graph.
 */
package com.codeintel.analyzers.graphanalysis

import com.codeintel.analyzers.graphanalysis.utils.GraphLoader
import com.codeintel.analyzers.graphanalysis.utils.TestFileDetector

class RelatedTestFinder(private val graphLoader: GraphLoader) {
    private val testDetector = TestFileDetector()

    fun find(symbolName: String, maxDepth: Int = 3, filePath: String? = null): RelatedTestResult? {
        val symbolId = graphLoader.resolveSymbolId(symbolName, filePath) ?: return null
        val symbolInfo = graphLoader.getSymbolInfo(symbolId) ?: return null
        val reverseGraph = graphLoader.loadReverseCallGraph()
        val callerPaths = reverseBFS(symbolId, reverseGraph, maxDepth)

        val directTests = mutableListOf<TestReference>()
        val indirectTests = mutableListOf<TestReference>()

        for (caller in callerPaths) {
            val info = graphLoader.getSymbolInfo(caller.symbolId) ?: continue
            val isTest = testDetector.isTestFile(info.filePath) || testDetector.isTestFunction(info.name)
            if (!isTest) continue
            val ref = TestReference(
                symbolId = caller.symbolId, testName = info.name,
                filePath = info.filePath, depth = caller.depth,
                path = listOf(info.name) + caller.pathIds.map { id ->
                    graphLoader.getSymbolInfo(id)?.name ?: "$id"
                },
            )
            if (caller.depth == 1) directTests.add(ref) else indirectTests.add(ref)
        }
        return RelatedTestResult(
            symbol = SymbolRef(symbolId, symbolInfo.name, symbolInfo.filePath),
            directTests = directTests, indirectTests = indirectTests,
            totalTests = directTests.size + indirectTests.size,
        )
    }

    private fun reverseBFS(startId: Int, reverseGraph: AdjacencyList, maxDepth: Int): List<CallerPath> {
        val visited = mutableSetOf(startId)
        val queue = ArrayDeque<Triple<Int, Int, List<Int>>>() // id, depth, path
        queue.addLast(Triple(startId, 0, emptyList()))
        val results = mutableListOf<CallerPath>()

        while (queue.isNotEmpty()) {
            val (id, depth, path) = queue.removeFirst()
            if (depth > maxDepth) continue
            for (caller in reverseGraph[id] ?: emptyList()) {
                if (caller in visited) continue
                visited.add(caller)
                val newPath = path + id
                results.add(CallerPath(caller, depth + 1, newPath))
                queue.addLast(Triple(caller, depth + 1, newPath))
            }
        }
        return results
    }

    private data class CallerPath(val symbolId: Int, val depth: Int, val pathIds: List<Int>)
}
