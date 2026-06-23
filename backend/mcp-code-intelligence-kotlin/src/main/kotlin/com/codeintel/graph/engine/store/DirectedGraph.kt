/** Core directed graph data structure with thread-safe read/write. KSA-173. */
package com.codeintel.graph.engine.store

import com.codeintel.graph.engine.model.GraphEdge
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

class DirectedGraph<T> {
    private val nodes: MutableMap<String, T> = ConcurrentHashMap()
    private val forwardEdges: MutableMap<String, MutableList<GraphEdge>> = ConcurrentHashMap()
    private val reverseEdges: MutableMap<String, MutableList<GraphEdge>> = ConcurrentHashMap()
    private val edgeIndex: MutableMap<String, GraphEdge> = ConcurrentHashMap()
    private val rwLock = ReentrantReadWriteLock()

    fun addNode(id: String, data: T) = rwLock.write {
        nodes[id] = data
        forwardEdges.putIfAbsent(id, mutableListOf())
        reverseEdges.putIfAbsent(id, mutableListOf())
    }

    fun removeNode(id: String) = rwLock.write {
        nodes.remove(id)
        forwardEdges.remove(id)?.forEach { edgeIndex.remove(it.id) }
        reverseEdges.remove(id)?.forEach { edgeIndex.remove(it.id) }
        forwardEdges.values.forEach { list -> list.removeAll { it.target == id } }
        reverseEdges.values.forEach { list -> list.removeAll { it.source == id } }
    }

    fun addEdge(edge: GraphEdge) = rwLock.write {
        val e = if (edge.id.isEmpty()) edge.copy(id = GraphEdge.generateId()) else edge
        forwardEdges.getOrPut(e.source) { mutableListOf() }.add(e)
        reverseEdges.getOrPut(e.target) { mutableListOf() }.add(e)
        edgeIndex[e.id] = e
    }

    fun removeEdge(edgeId: String) = rwLock.write {
        val edge = edgeIndex.remove(edgeId) ?: return@write
        forwardEdges[edge.source]?.removeAll { it.id == edgeId }
        reverseEdges[edge.target]?.removeAll { it.id == edgeId }
    }

    fun getSuccessors(nodeId: String): List<String> = rwLock.read {
        forwardEdges[nodeId]?.map { it.target } ?: emptyList()
    }

    fun getPredecessors(nodeId: String): List<String> = rwLock.read {
        reverseEdges[nodeId]?.map { it.source } ?: emptyList()
    }

    fun getOutEdges(nodeId: String): List<GraphEdge> = rwLock.read {
        forwardEdges[nodeId]?.toList() ?: emptyList()
    }

    fun getInEdges(nodeId: String): List<GraphEdge> = rwLock.read {
        reverseEdges[nodeId]?.toList() ?: emptyList()
    }

    fun getNode(id: String): T? = rwLock.read { nodes[id] }

    fun nodeCount(): Int = nodes.size

    fun edgeCount(): Int = edgeIndex.size

    fun containsNode(id: String): Boolean = nodes.containsKey(id)

    fun getAllNodes(): Set<String> = rwLock.read { nodes.keys.toSet() }

    fun getAllNodeData(): Map<String, T> = rwLock.read { nodes.toMap() }

    fun clear() = rwLock.write {
        nodes.clear()
        forwardEdges.clear()
        reverseEdges.clear()
        edgeIndex.clear()
    }
}
