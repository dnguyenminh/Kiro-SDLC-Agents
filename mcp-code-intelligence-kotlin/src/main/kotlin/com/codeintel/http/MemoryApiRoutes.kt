/** REST API routes for memory engine — search, list, graph, stats. */
package com.codeintel.http

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.search.HybridSearch
import com.codeintel.memory.search.SearchParams
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

/** Install memory API routes under /api/memory. Uses lambdas for late-binding. */
fun Route.memoryApiRoutes(engineProvider: () -> MemoryEngine?, graphProvider: () -> KnowledgeGraph?) {
    route("/api/memory") {
        get("/status") { handleStatus(engineProvider()) }
        get("/search") { handleSearch(engineProvider(), graphProvider()) }
        get("/entries") { handleList(engineProvider()) }
        get("/entries/{id}") { handleGet(engineProvider()) }
        get("/graph/{id}/neighbors") { handleGraphNeighbors(engineProvider(), graphProvider()) }
        get("/graph/data") { handleGraphData(engineProvider(), graphProvider()) }
    }
}

private suspend fun RoutingContext.handleStatus(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized"); return }
    val stats = engine.getStats()
    call.respond(MemoryStatusResponse(stats.totalEntries, stats.totalEdges, stats.totalVectors, stats.tierBreakdown))
}

private suspend fun RoutingContext.handleSearch(engine: MemoryEngine?, graph: KnowledgeGraph?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized"); return }
    val query = call.parameters["q"] ?: ""
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 10
    val tier = call.parameters["tier"]
    val search = HybridSearch(engine.search, engine.vectors, null, graph)
    val results = search.search(SearchParams(query, limit, tier))
    call.respond(results.map { EntryResponse.from(it.entry, it.score) })
}

private suspend fun RoutingContext.handleList(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized"); return }
    val tier = call.parameters["tier"]
    val type = call.parameters["type"]
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 20
    val offset = call.parameters["offset"]?.toIntOrNull() ?: 0
    val sort = call.parameters["sort"] ?: "created_at"
    val afterId = call.parameters["after_id"]?.toLongOrNull()
    val entries = engine.knowledge.findFiltered(tier, type, limit, offset, sort, afterId)
    call.respond(entries.map { EntryResponse.from(it) })
}

private suspend fun RoutingContext.handleGet(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized"); return }
    val id = call.parameters["id"]?.toLongOrNull() ?: run {
        call.respond(HttpStatusCode.BadRequest, "Invalid id"); return
    }
    val entry = engine.knowledge.findById(id) ?: run {
        call.respond(HttpStatusCode.NotFound, "Not found"); return
    }
    engine.knowledge.recordAccess(id)
    call.respond(EntryDetailResponse.from(entry))
}

private suspend fun RoutingContext.handleGraphNeighbors(engine: MemoryEngine?, graph: KnowledgeGraph?) {
    if (engine == null || graph == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Not initialized"); return }
    val id = call.parameters["id"]?.toLongOrNull() ?: run {
        call.respond(HttpStatusCode.BadRequest, "Invalid id"); return
    }
    val neighbors = graph.getConnected(id)
    val entries = neighbors.mapNotNull { engine.knowledge.findById(it) }
    call.respond(entries.map { EntryResponse.from(it) })
}

private suspend fun RoutingContext.handleGraphData(engine: MemoryEngine?, graph: KnowledgeGraph?) {
    if (engine == null || graph == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Not initialized"); return }
    val stats = engine.getStats()
    if (stats.totalEdges == 0) {
        // No edges yet — return entries as unconnected nodes (no DB query for edges)
        val entries = engine.knowledge.findByTier("WORKING", 50)
        val nodes = entries.map { GraphNodeResponse(it.id, it.summary.take(60), it.type, it.tier, it.source) }
        call.respond(GraphDataResponse(nodes, emptyList()))
        return
    }
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 100
    val edges = engine.graph.findAll(limit)
    val nodeIds = edges.flatMap { listOf(it.sourceId, it.targetId) }.distinct()
    val nodes = nodeIds.mapNotNull { id ->
        engine.knowledge.findById(id)?.let { GraphNodeResponse(it.id, it.summary.take(60), it.type, it.tier, it.source) }
    }
    val edgeList = edges.map { GraphEdgeResponse(it.sourceId, it.targetId, it.relation) }
    call.respond(GraphDataResponse(nodes, edgeList))
}

@Serializable
data class MemoryStatusResponse(
    val totalEntries: Int,
    val totalEdges: Int,
    val totalVectors: Int,
    val tierBreakdown: Map<String, Int>
)

@Serializable
data class EntryResponse(
    val id: Long,
    val summary: String,
    val type: String,
    val tier: String,
    val confidence: Double,
    val accessCount: Int,
    val source: String?,
    val tags: String,
    val score: Double = 0.0
) {
    companion object {
        fun from(e: KnowledgeEntry, score: Double = 0.0) = EntryResponse(
            id = e.id, summary = e.summary, type = e.type, tier = e.tier,
            confidence = e.confidence, accessCount = e.accessCount,
            source = e.source, tags = e.tags, score = score
        )
    }
}

@Serializable
data class EntryDetailResponse(
    val id: Long,
    val summary: String,
    val content: String,
    val type: String,
    val tier: String,
    val confidence: Double,
    val accessCount: Int,
    val source: String?,
    val tags: String
) {
    companion object {
        fun from(e: KnowledgeEntry) = EntryDetailResponse(
            id = e.id, summary = e.summary, content = e.content,
            type = e.type, tier = e.tier, confidence = e.confidence,
            accessCount = e.accessCount, source = e.source, tags = e.tags
        )
    }
}

@Serializable
data class GraphNodeResponse(
    val id: Long,
    val summary: String,
    val type: String,
    val tier: String,
    val source: String? = null
)

@Serializable
data class GraphEdgeResponse(
    val source: Long,
    val target: Long,
    val relation: String
)

@Serializable
data class GraphDataResponse(
    val nodes: List<GraphNodeResponse>,
    val edges: List<GraphEdgeResponse>
)
