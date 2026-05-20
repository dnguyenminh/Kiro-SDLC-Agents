/** REST API routes for memory ingestion — POST /api/memory/ingest, /api/memory/ingest-file. */
package com.codeintel.http

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.ingest.IngestDeduplicator
import com.codeintel.memory.ingest.IngestFileExecutor
import com.codeintel.memory.ingest.IngestPipeline
import com.codeintel.viewerServer
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
        post("/ingest-file") { handleIngestFile(engineProvider(), embeddingProvider()) }
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

@Serializable
data class IngestFileRequest(
    val file_path: String,
    val type: String? = null,
    val format: String? = null
)

@Serializable
data class IngestFileResponse(
    val file_path: String,
    val entries_created: Int,
    val skipped: Boolean = false,
    val reason: String? = null
)

@Serializable
data class IngestBatchRequest(
    val files: List<IngestFileRequest>
)

@Serializable
data class IngestBatchResponse(
    val total: Int,
    val ingested: Int,
    val skipped: Int,
    val results: List<IngestFileResponse>
)

private suspend fun RoutingContext.handleIngestFile(engine: MemoryEngine?, embedding: EmbeddingService?) {
    if (engine == null) {
        call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized")
        return
    }
    val body = runCatching { call.receive<IngestBatchRequest>() }.getOrNull()
    if (body != null) {
        handleBatchIngest(engine, embedding, body)
        return
    }
    // Single file
    val single = runCatching { call.receive<IngestFileRequest>() }.getOrNull() ?: run {
        call.respond(HttpStatusCode.BadRequest, "Invalid request: need {file_path} or {files:[]}")
        return
    }
    val result = ingestSingleFile(engine, embedding, single)
    call.respond(HttpStatusCode.OK, result)
}

private suspend fun RoutingContext.handleBatchIngest(
    engine: MemoryEngine?, embedding: EmbeddingService?, batch: IngestBatchRequest
) {
    val results = batch.files.map { req -> ingestSingleFile(engine!!, embedding, req) }
    val ingested = results.count { !it.skipped }
    val skipped = results.count { it.skipped }
    call.respond(HttpStatusCode.OK, IngestBatchResponse(
        total = results.size, ingested = ingested, skipped = skipped, results = results
    ))
}

private fun ingestSingleFile(engine: MemoryEngine, embedding: EmbeddingService?, req: IngestFileRequest): IngestFileResponse {
    val pipeline = IngestPipeline(engine.knowledge, embedding)
    val deduplicator = IngestDeduplicator(engine.connection)
    val workspace = viewerServer?.config?.workspace ?: ""
    val executor = IngestFileExecutor(pipeline, workspace, deduplicator)

    val type = req.type ?: "CONTEXT"
    val format = req.format ?: "markdown"
    val result = executor.ingest(req.file_path, type, format)
        ?: return IngestFileResponse(req.file_path, 0, skipped = true, reason = "file not found")

    if (result.skipped) {
        return IngestFileResponse(req.file_path, 0, skipped = true, reason = result.skipReason)
    }

    engine.currentSessionId?.let { engine.sessions.incrementObservations(it) }
    engine.audit.log("INGEST_FILE_HTTP", sessionId = engine.currentSessionId,
        details = "HTTP ingest: ${result.entriesCreated} entries from ${req.file_path}")

    return IngestFileResponse(req.file_path, result.entriesCreated)
}
