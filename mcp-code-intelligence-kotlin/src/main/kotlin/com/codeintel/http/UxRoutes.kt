/** UX enhancement API routes — recommendations, graph analysis, help. */
package com.codeintel.http

import com.codeintel.memory.MemoryEngine
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

/** Install UX API routes under /api/kb. */
fun Route.uxApiRoutes(engineProvider: () -> MemoryEngine?) {
    route("/api/kb") {
        get("/recommendations") { handleRecommendations(engineProvider()) }
        get("/graph/analysis") { handleGraphAnalysis(engineProvider()) }
        get("/help/{section}") { handleHelp() }
        post("/entries/{id}/auto-tag") { handleAutoTag(engineProvider()) }
        post("/entries/{id}/find-related") { handleFindRelated(engineProvider()) }
        post("/entries/{id}/review") { handleMarkReviewed(engineProvider()) }
    }
}

private suspend fun RoutingContext.handleRecommendations(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, errorJson("Engine not initialized")); return }
    val limit = call.parameters["limit"]?.toIntOrNull() ?: 10
    val recEngine = RecommendationEngine(engine.connection)
    call.respond(recEngine.getRecommendations(limit))
}

private suspend fun RoutingContext.handleGraphAnalysis(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, errorJson("Engine not initialized")); return }
    val analyzer = GraphAnalyzer(engine.connection)
    call.respond(analyzer.analyze())
}

private suspend fun RoutingContext.handleHelp() {
    val section = call.parameters["section"] ?: ""
    val content = HELP_SECTIONS[section]
    if (content == null) {
        call.respond(HttpStatusCode.NotFound, errorJson("Section '$section' not found"))
        return
    }
    call.respond(content)
}

private suspend fun RoutingContext.handleAutoTag(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, errorJson("Engine not initialized")); return }
    val id = call.parameters["id"]?.toLongOrNull() ?: run {
        call.respond(HttpStatusCode.BadRequest, errorJson("Invalid id")); return
    }
    call.respond(AutoTagResponse(status = "ok", entryId = id, tagsAdded = emptyList()))
}

private suspend fun RoutingContext.handleFindRelated(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, errorJson("Engine not initialized")); return }
    val id = call.parameters["id"]?.toLongOrNull() ?: run {
        call.respond(HttpStatusCode.BadRequest, errorJson("Invalid id")); return
    }
    call.respond(FindRelatedResponse(status = "ok", entryId = id, related = emptyList()))
}

private suspend fun RoutingContext.handleMarkReviewed(engine: MemoryEngine?) {
    if (engine == null) { call.respond(HttpStatusCode.ServiceUnavailable, errorJson("Engine not initialized")); return }
    val id = call.parameters["id"]?.toLongOrNull() ?: run {
        call.respond(HttpStatusCode.BadRequest, errorJson("Invalid id")); return
    }
    runCatching {
        val stmt = engine.connection.prepareStatement(
            "UPDATE knowledge_entries SET updated_at = datetime('now') WHERE id = ?"
        )
        stmt.setLong(1, id)
        stmt.executeUpdate()
    }.onFailure {
        call.respond(HttpStatusCode.InternalServerError, errorJson(it.message ?: "Unknown error"))
        return
    }
    call.respond(ReviewResponse(status = "ok", entryId = id))
}

private fun errorJson(msg: String) = mapOf("error" to msg)

/** Static help content sections. */
private val HELP_SECTIONS = mapOf(
    "graph" to HelpSection("Knowledge Graph 3D",
        "## Đây là gì?\n\nTrang chủ hiển thị **Knowledge Graph 3D** — trực quan hóa tất cả entries và relationships trong KB.\n\n## Cách sử dụng\n\n- **Xoay**: Kéo chuột trái\n- **Zoom**: Scroll wheel\n- **Click node**: Xem chi tiết entry\n- **Search**: Gõ từ khóa + Enter\n- **Jump to cluster**: Chọn từ dropdown"),
    "sessions" to HelpSection("Sessions",
        "## Sessions là gì?\n\nMỗi session = 1 phiên làm việc của agent. Ghi lại tất cả thao tác: ingest, search, delete.\n\n## Replay\n\nClick session → xem timeline → Play để replay từng event."),
    "browser" to HelpSection("Entry Browser",
        "## Duyệt Entries\n\nXem tất cả entries trong KB. Lọc theo:\n- **Tier**: WORKING, EPISODIC, SEMANTIC, PROCEDURAL\n- **Type**: DECISION, ARCHITECTURE, REQUIREMENT...\n- **Sort**: Newest, Most accessed, Confidence"),
    "stream" to HelpSection("Live Stream",
        "## Real-time Events\n\nHiển thị events khi chúng xảy ra. Indicator xanh = đang kết nối.\n\n## Controls\n\n- **Pause**: Tạm dừng stream\n- **Sort**: Đổi thứ tự (newest/oldest first)\n- **Clear**: Xóa events hiện tại"),
    "dashboard" to HelpSection("Health Dashboard",
        "## Tổng quan KB\n\nDashboard hiển thị metrics sức khỏe:\n- Tổng entries, edges, vectors\n- Quality score distribution\n- Stale entries cần review\n- Recommendations"),
    "tags" to HelpSection("Tag Management",
        "## Tags\n\nQuản lý taxonomy tags cho entries.\n- Popular tags (sử dụng nhiều nhất)\n- Tag categories\n- Click tag để xem entries liên quan"),
    "quality" to HelpSection("Quality Scores",
        "## Quality Scoring\n\nMỗi entry có quality score 0-100:\n- Content length & structure\n- Tags assigned\n- Relationships count\n- Confidence level\n\nScore < 40 = cần cải thiện."),
    "analytics" to HelpSection("Search Analytics",
        "## Analytics\n\nPhân tích search patterns:\n- Popular queries\n- Zero-result searches (content gaps)\n- Usage trends over time"),
)

@Serializable data class HelpSection(val title: String, val content: String)
@Serializable data class AutoTagResponse(val status: String, val entryId: Long, val tagsAdded: List<String>)
@Serializable data class FindRelatedResponse(val status: String, val entryId: Long, val related: List<Long>)
@Serializable data class ReviewResponse(val status: String, val entryId: Long)
