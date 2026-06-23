/** Dependency graph builder — constructs file-level import graph. KSA-173. */
package com.codeintel.graph.engine.builder

import com.codeintel.graph.engine.model.*
import com.codeintel.graph.engine.store.DirectedGraph

class DependencyGraphBuilder(private val provider: ParserDataProvider) {

    fun build(): CodeGraph {
        val startTime = System.currentTimeMillis()
        val graph = DirectedGraph<GraphNode>()
        val files = provider.getAllFiles()

        // Phase 1: Add file nodes
        for (file in files) {
            graph.addNode(file, GraphNode(
                id = file,
                type = NodeType.FILE,
                name = file.substringAfterLast("/"),
                filePath = file
            ))
        }

        // Phase 2: Add import edges
        for (file in files) {
            val edges = provider.getImportEdges(file)
            for (edge in edges) {
                addImportEdge(graph, edge, files)
            }
        }

        val elapsed = System.currentTimeMillis() - startTime
        return CodeGraph(
            type = GraphType.DEPENDENCY_GRAPH,
            graph = graph,
            metadata = GraphMetadata(
                totalFiles = files.size,
                totalNodes = graph.nodeCount(),
                totalEdges = graph.edgeCount(),
                buildTimeMs = elapsed
            )
        )
    }

    private fun addImportEdge(graph: DirectedGraph<GraphNode>, edge: GraphEdge, files: List<String>) {
        val targetFile = resolveImportTarget(edge.target, files)
        if (targetFile == edge.source) return // skip self-imports

        // Ensure target node exists (may be external)
        if (!graph.containsNode(targetFile)) {
            graph.addNode(targetFile, GraphNode(
                id = targetFile,
                type = NodeType.EXTERNAL,
                name = targetFile.substringAfterLast("/"),
                filePath = targetFile
            ))
        }

        graph.addEdge(edge.copy(target = targetFile))
    }

    private fun resolveImportTarget(target: String, files: List<String>): String {
        // Direct match
        if (target in files) return target

        // Try matching by suffix
        val match = files.firstOrNull { it.endsWith(target) || it.endsWith("$target.kt") || it.endsWith("$target.ts") }
        return match ?: target
    }
}
