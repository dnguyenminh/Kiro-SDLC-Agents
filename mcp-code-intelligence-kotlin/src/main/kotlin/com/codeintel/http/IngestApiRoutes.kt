/** REST API routes for memory ingestion — POST /api/memory/ingest. */
package com.codeintel.http

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.ingest.IngestPipeline
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

/** Install ingest API routes under /api/memory. */
fun Route.ingestApiRoutes(
    engineProvider: () -> MemoryEngine?,
    embeddingProvider: () -> EmbeddingService?
) {
    route("/api/memory") {
        post("/ingest") { handleIngest(engineProvider(), embeddingProvider()) }
    }
}

private suspend fun RoutingContext.handleIngest(engine: MemoryEngine?, embedding: EmbeddingService?) {
    if (engine == null) {
        call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized")
        return
    }
    val body = runCatching { call.receive<IngestRequest>() }.getOrNull() ?: run {
        call.respond(HttpStatusCode.BadRequest, "Invalid request body")
        return
    }
    if (body.content.isBlank()) {
        call.respond(HttpStatusCode.BadRequest, "content is required")
        return
    }
    val pipeline = IngestPipeline(engine.knowledge, embedding)
    val summary = body.summary?.takeIf { it.isNotBlank() } ?: body.content.take(120)
    val type = body.type?.takeIf { it.isNotBlank() } ?: "CONTEXT"
    val tags = body.tags ?: ""

    val id = pipeline.ingestEntry(body.content, summary, type, body.source, tags)
    engine.currentSessionId?.let { engine.sessions.incrementObservations(it) }
    engine.audit.log("INGEST", sessionId = engine.currentSessionId, details = "HTTP ingest id=$id type=$type")

    call.respond(HttpStatusCode.Created, IngestResponse(id = id, type = type, tier = "WORKING"))
}

@Serializable
data class IngestRequest(
    val content: String,
    val type: String? = null,
    val source: String? = null,
    val summary: String? = null,
    val tags: String? = null
)

@Serializable
data class IngestResponse(
    val id: Long,
    val type: String,
    val tier: String
)
