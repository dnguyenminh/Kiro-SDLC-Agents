/** REST API routes for sessions and session events. */
package com.codeintel.http

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.repository.AuditEntry
import com.codeintel.memory.repository.MemorySession
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

/** Install session API routes under /api/memory. */
fun Route.sessionApiRoutes(engineProvider: () -> MemoryEngine?) {
    route("/api/memory") {
        get("/sessions") { handleSessions(engineProvider()) }
        get("/sessions/{id}/events") { handleSessionEvents(engineProvider()) }
    }
}

private suspend fun RoutingContext.handleSessions(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized"); return }
    val agent = call.parameters["agent"] ?: ""
    val status = call.parameters["status"] ?: ""
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 50
    val sessions = engine.sessions.listFiltered(agent, status, limit)
    call.respond(sessions.map { it.toResponse() })
}

private suspend fun RoutingContext.handleSessionEvents(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, "Memory not initialized"); return }
    val sessionId = call.parameters["id"] ?: run {
        call.respond(HttpStatusCode.BadRequest, "Missing session id"); return
    }
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 200
    val events = engine.audit.listBySession(sessionId, limit)
    call.respond(events.map { it.toResponse() })
}

private fun MemorySession.toResponse() = SessionResponse(
    id = sessionId, agentName = agentName,
    startedAt = startedAt, endedAt = endedAt,
    observationCount = observationCount, status = status
)

private fun AuditEntry.toResponse() = EventResponse(
    id = id, operation = operation,
    entryId = entryId, sessionId = sessionId,
    details = details, createdAt = createdAt
)

@Serializable
data class SessionResponse(
    val id: String,
    val agentName: String?,
    val startedAt: String,
    val endedAt: String?,
    val observationCount: Int,
    val status: String
)

@Serializable
data class EventResponse(
    val id: Long,
    val operation: String,
    val entryId: Long?,
    val sessionId: String?,
    val details: String?,
    val createdAt: String
)
