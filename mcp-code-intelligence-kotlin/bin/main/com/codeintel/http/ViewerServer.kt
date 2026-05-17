/**
 * Ktor HTTP server — serves REST API + Knowledge Graph Web Viewer.
 * Runs as daemon thread alongside the stdio MCP transport.
 */
package com.codeintel.http

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.memory.MemoryEngine
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

class ViewerServer(
    private val config: Config
) {
    /** Mutable reference — set after MCP initialize completes. */
    @Volatile var memoryEngine: MemoryEngine? = null
    @Volatile var knowledgeGraph: KnowledgeGraph? = null

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
            get("/") { call.respondText(VIEWER_HTML, ContentType.Text.Html) }
            get("/api/health") { call.respond(buildHealthResponse()) }
            memoryApiRoutes({ memoryEngine }, { knowledgeGraph })
        }
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

@Serializable
data class HealthResponse(
    val status: String,
    val version: String,
    val workspace: String,
    val viewerPort: Int,
    val memoryEnabled: Boolean = false
)
