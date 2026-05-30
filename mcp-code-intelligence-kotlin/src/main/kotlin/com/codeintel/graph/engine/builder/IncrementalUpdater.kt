/** Incremental graph updater — handles file changes without full rebuild. KSA-173. */
package com.codeintel.graph.engine.builder

import com.codeintel.graph.engine.model.CodeGraph
import com.codeintel.graph.engine.model.GraphMetadata
import com.codeintel.graph.engine.model.GraphNode
import com.codeintel.graph.engine.store.DirectedGraph
import java.time.Instant
import java.util.concurrent.ConcurrentLinkedQueue

enum class ChangeType { CREATED, MODIFIED, DELETED }

data class FileChange(val filePath: String, val type: ChangeType, val timestamp: Instant = Instant.now())

class IncrementalUpdater(
    private val provider: ParserDataProvider,
    private val incrementalThreshold: Double = 0.3
) {
    private val pendingChanges = ConcurrentLinkedQueue<FileChange>()

    fun enqueue(change: FileChange) {
        pendingChanges.add(change)
    }

    /**
     * Apply pending changes to the graph. Returns true if incremental update was applied,
     * false if a full rebuild is needed (too many changes).
     */
    fun applyTo(codeGraph: CodeGraph): Boolean {
        val changes = drainChanges()
        if (changes.isEmpty()) return true

        val totalFiles = codeGraph.metadata.totalFiles
        if (totalFiles > 0 && changes.size > totalFiles * incrementalThreshold) {
            return false // signal full rebuild needed
        }

        val graph = codeGraph.graph
        for (change in changes) {
            when (change.type) {
                ChangeType.DELETED -> removeFile(graph, change.filePath)
                ChangeType.MODIFIED -> updateFile(graph, change.filePath)
                ChangeType.CREATED -> addFile(graph, change.filePath)
            }
        }
        return true
    }

    private fun removeFile(graph: DirectedGraph<GraphNode>, filePath: String) {
        val nodeIds = graph.getAllNodes().filter { it.startsWith("$filePath::") || it == filePath }
        for (nodeId in nodeIds) {
            graph.removeNode(nodeId)
        }
    }

    private fun updateFile(graph: DirectedGraph<GraphNode>, filePath: String) {
        removeFile(graph, filePath)
        addFile(graph, filePath)
    }

    private fun addFile(graph: DirectedGraph<GraphNode>, filePath: String) {
        val nodes = provider.getSymbolNodes(filePath)
        for (node in nodes) graph.addNode(node.id, node)

        val edges = provider.getCallEdges(filePath)
        for (edge in edges) graph.addEdge(edge)
    }

    private fun drainChanges(): List<FileChange> {
        val changes = mutableListOf<FileChange>()
        while (pendingChanges.isNotEmpty()) {
            pendingChanges.poll()?.let { changes.add(it) }
        }
        return changes
    }
}
