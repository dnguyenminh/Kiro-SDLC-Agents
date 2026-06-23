/** KB Viewer API routes — dashboard, tags, quality, analytics, citations, reminders. */
package com.codeintel.http

import com.codeintel.memory.MemoryEngine
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

/** Install KB viewer routes under /api/kb for dashboard, tags, quality, analytics pages. */
fun Route.kbViewerRoutes(engineProvider: () -> MemoryEngine?) {
    route("/api/kb") {
        get("/dashboard") { handleDashboard(engineProvider()) }
        get("/tags") { handleTags(engineProvider()) }
        get("/tags/popular") { handlePopularTags(engineProvider()) }
        get("/quality") { handleQuality(engineProvider()) }
        get("/quality/low") { handleLowQuality(engineProvider()) }
        get("/analytics") { handleAnalytics(engineProvider()) }
        get("/health") { handleHealth(engineProvider()) }
        get("/citations/most") { handleMostCited(engineProvider()) }
        get("/reminders") { handleReminders(engineProvider()) }
        get("/suggestions") { handleSuggestions(engineProvider()) }
    }
}

private suspend fun RoutingContext.handleDashboard(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val dashboard = HealthDashboardService(engine.connection)
    call.respond(dashboard.getDashboard())
}

private suspend fun RoutingContext.handleTags(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val service = TagService(engine.connection)
    call.respond(service.getTaxonomy())
}

private suspend fun RoutingContext.handlePopularTags(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 20
    val service = TagService(engine.connection)
    call.respond(service.getPopular(limit))
}

private suspend fun RoutingContext.handleQuality(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val service = QualityService(engine.connection)
    call.respond(service.getStats())
}

private suspend fun RoutingContext.handleLowQuality(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val threshold = call.parameters["threshold"]?.toIntOrNull() ?: 40
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 20
    val service = QualityService(engine.connection)
    call.respond(service.getLowQuality(threshold, limit))
}

private suspend fun RoutingContext.handleAnalytics(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val service = AnalyticsService(engine.connection)
    call.respond(service.getAnalytics())
}

private suspend fun RoutingContext.handleHealth(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val dashboard = HealthDashboardService(engine.connection)
    call.respond(dashboard.getMetrics())
}

private suspend fun RoutingContext.handleMostCited(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 10
    val service = CitationService(engine.connection)
    call.respond(service.getMostCited(limit))
}

private suspend fun RoutingContext.handleReminders(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val service = ReminderService(engine.connection)
    call.respond(service.getDueReminders())
}

private suspend fun RoutingContext.handleSuggestions(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Engine not initialized")); return }
    val q = call.parameters["q"] ?: ""
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 5
    val service = SuggestionService(engine.connection)
    call.respond(service.suggest(q, limit))
}
