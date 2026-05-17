/**
 * Ktor HTTP server — serves REST API + Knowledge Graph Web Viewer.
 * Runs as daemon thread alongside the stdio MCP transport.
 */
package com.codeintel.http

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.graph.KnowledgeGraph
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

class ViewerServer(
    private val config: Config
) {
    /** Mutable references — set after MCP initialize completes. */
    @Volatile var memoryEngine: MemoryEngine? = null
    @Volatile var knowledgeGraph: KnowledgeGraph? = null
    @Volatile var embeddingService: EmbeddingService? = null

    /** Start HTTP server (blocking within its thread). */
    fun start() {
        val server = embeddedServer(Netty, port = config.viewerPort) {
            configurePlugins()
            configureRouting()
        }
        log("HTTP viewer starting on port ${config.viewerPort}")
        server.start(wait = true)
    }

    private fun Application.configurePlugins() {
        install(ContentNegotiation) {
            json(Json { encodeDefaults = true; ignoreUnknownKeys = true })
        }
        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.ContentType)
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
        }
    }

    private fun Application.configureRouting() {
        routing {
            get("/") { call.respondText(loadViewerHtml(), ContentType.Text.Html) }
            get("/{file}.js") { serveStaticFile(call, call.parameters["file"] + ".js", "application/javascript") }
            get("/{file}.css") { serveStaticFile(call, call.parameters["file"] + ".css", "text/css") }
            get("/api/health") { call.respond(buildHealthResponse()) }
            memoryApiRoutes({ memoryEngine }, { knowledgeGraph })
            ingestApiRoutes({ memoryEngine }, { embeddingService })
            sessionApiRoutes({ memoryEngine })
        }
    }

    private suspend fun serveStaticFile(call: io.ktor.server.application.ApplicationCall, filename: String, contentType: String) {
        val file = File(config.workspace, "shared/viewer/$filename")
        if (file.exists() && !filename.contains("..")) {
            call.respondText(file.readText(Charsets.UTF_8), ContentType.parse(contentType))
        } else {
            call.respond(HttpStatusCode.NotFound, "Not found")
        }
    }

    private fun loadViewerHtml(): String {
        return loadSharedViewerHtml(config.workspace) ?: VIEWER_HTML
    }

    private fun buildHealthResponse(): HealthResponse {
        return HealthResponse(
            status = "ok",
            version = "0.1.0",
            workspace = config.workspace,
            viewerPort = config.viewerPort,
            memoryEnabled = memoryEngine != null
        )
    }
}

/** Load shared viewer HTML from disk. Returns null if file not found. */
fun loadSharedViewerHtml(workspace: String): String? {
    val sharedFile = File(workspace, "shared/viewer/index.html")
    return if (sharedFile.exists()) sharedFile.readText(Charsets.UTF_8) else null
}

@Serializable
data class HealthResponse(
    val status: String,
    val version: String,
    val workspace: String,
    val viewerPort: Int,
    val memoryEnabled: Boolean = false
)
