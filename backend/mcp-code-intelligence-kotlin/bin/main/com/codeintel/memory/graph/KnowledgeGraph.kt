/** In-memory knowledge graph with SQLite persistence. */
package com.codeintel.memory.graph

import com.codeintel.log
import com.codeintel.memory.models.GraphEdge
import com.codeintel.memory.repository.GraphRepository

class KnowledgeGraph(private val repo: GraphRepository) {
    private val adjacency = mutableMapOf<Long, MutableSet<Long>>()
    private val reverseAdj = mutableMapOf<Long, MutableSet<Long>>()
    private val edgeCache = mutableMapOf<Long, GraphEdge>()

    /** Load graph from database into memory. */
    fun loadFromDb() {
        val allEdges = repo.findAll()
        for (edge in allEdges) addToMemory(edge)
        log("Graph loaded: ${adjacency.size} nodes, ${edgeCache.size} edges")
    }

    /** Add edge and persist to DB. */
    fun addEdge(edge: GraphEdge): Long {
        val id = repo.addEdge(edge)
        addToMemory(edge.copy(id = id))
        return id
    }

    /** Remove edge from graph and DB. */
    fun removeEdge(edgeId: Long) {
        repo.removeEdge(edgeId)
        removeFromMemory(edgeId)
    }

    /** Get all neighbors of a node (outgoing). */
    fun getNeighbors(nodeId: Long): Set<Long> {
        return adjacency[nodeId] ?: emptySet()
    }

    /** Get nodes pointing to this node (incoming). */
    fun getPredecessors(nodeId: Long): Set<Long> {
        return reverseAdj[nodeId] ?: emptySet()
    }

    /** Get all connected nodes (both directions). */
    fun getConnected(nodeId: Long): Set<Long> {
        return getNeighbors(nodeId) + getPredecessors(nodeId)
    }

    /** BFS traversal from a start node, up to maxDepth. */
    fun bfs(startId: Long, maxDepth: Int = 3): List<Long> {
        return GraphTraversal.bfs(adjacency, startId, maxDepth)
    }

    /** Find shortest path between two nodes. */
    fun shortestPath(fromId: Long, toId: Long): List<Long>? {
        return GraphTraversal.shortestPath(adjacency, fromId, toId)
    }

    /** Get subgraph around a node (ego graph). */
    fun egoGraph(nodeId: Long, radius: Int = 2): Set<Long> {
        return GraphTraversal.egoGraph(adjacency, reverseAdj, nodeId, radius)
    }

    /** Count nodes in graph. */
    fun nodeCount(): Int = adjacency.size

    /** Count edges in graph. */
    fun edgeCount(): Int = edgeCache.size

    /** Add edge only if no edge exists between source and target with same relation. */
    fun addEdgeIfNotExists(sourceId: Long, targetId: Long, relation: String): Long? {
        val existing = adjacency[sourceId]?.contains(targetId) == true
        if (existing) return null
        val edge = GraphEdge(sourceId = sourceId, targetId = targetId, relation = relation)
        return addEdge(edge)
    }

    private fun addToMemory(edge: GraphEdge) {
        adjacency.getOrPut(edge.sourceId) { mutableSetOf() }.add(edge.targetId)
        reverseAdj.getOrPut(edge.targetId) { mutableSetOf() }.add(edge.sourceId)
        // Ensure both nodes exist as keys
        adjacency.getOrPut(edge.targetId) { mutableSetOf() }
        reverseAdj.getOrPut(edge.sourceId) { mutableSetOf() }
        edgeCache[edge.id] = edge
    }

    private fun removeFromMemory(edgeId: Long) {
        val edge = edgeCache.remove(edgeId) ?: return
        adjacency[edge.sourceId]?.remove(edge.targetId)
        reverseAdj[edge.targetId]?.remove(edge.sourceId)
    }
}
