/**
 * Ktor HTTP server — serves REST API + Knowledge Graph Web Viewer.
 * All HTML/CSS/JS served from shared/viewer/ (single source of truth).
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

class ViewerServer(val config: Config) {
    @Volatile var memoryEngine: MemoryEngine? = null
    @Volatile var knowledgeGraph: KnowledgeGraph? = null
    @Volatile var embeddingService: EmbeddingService? = null
    @Volatile var modelManager: com.codeintel.orchestration.models.ModelManager? = null

    private var engine: EmbeddedServer<*, *>? = null

    fun start() {
        engine = embeddedServer(Netty, port = config.viewerPort) {
            configurePlugins()
            configureRouting()
        }
        log("HTTP viewer starting on port ${config.viewerPort}")
        engine!!.start(wait = true)
    }

    fun stop() {
        engine?.stop(500, 1000)
        engine = null
        log("HTTP viewer stopped (port ${config.viewerPort} released)")
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
            get("/") { serveSharedFile(call, "index.html") }
            get("/dashboard") { serveSharedFile(call, "dashboard.html") }
            get("/tags") { serveSharedFile(call, "tags.html") }
            get("/quality") { serveSharedFile(call, "quality.html") }
            get("/analytics") { serveSharedFile(call, "analytics.html") }
            get("/{file}.js") { serveStaticFile(call, call.parameters["file"] + ".js", "application/javascript") }
            get("/{file}.css") { serveStaticFile(call, call.parameters["file"] + ".css", "text/css") }
            get("/modules/{file}.js") { serveSubdirFile(call, "modules/" + call.parameters["file"] + ".js", "application/javascript") }
            get("/config/{file}.json") { serveSubdirFile(call, "config/" + call.parameters["file"] + ".json", "application/json") }
            get("/api/health") { call.respond(buildHealthResponse()) }
            sseEventsRoute()
            modelApiRoutes { modelManager }
            memoryApiRoutes({ memoryEngine }, { knowledgeGraph })
            uxApiRoutes { memoryEngine }
            kbViewerRoutes { memoryEngine }
            ingestApiRoutes({ memoryEngine }, { embeddingService })
            sessionApiRoutes({ memoryEngine })
        }
    }

    private suspend fun serveSharedFile(call: ApplicationCall, filename: String) {
        val file = resolveSharedFile(filename)
        if (file != null) {
            call.respondText(file.readText(Charsets.UTF_8), ContentType.Text.Html)
        } else {
            call.respondText(viewerErrorPage(filename), ContentType.Text.Html, HttpStatusCode.ServiceUnavailable)
        }
    }

    private suspend fun serveStaticFile(call: ApplicationCall, filename: String, contentType: String) {
        val file = resolveSharedFile(filename)
        if (file != null) {
            call.respondText(file.readText(Charsets.UTF_8), ContentType.parse(contentType))
        } else {
            call.respond(HttpStatusCode.NotFound, "Not found")
        }
    }

    private suspend fun serveSubdirFile(call: ApplicationCall, relPath: String, contentType: String) {
        if (relPath.contains("..")) { call.respond(HttpStatusCode.NotFound, "Not found"); return }
        val file = resolveSharedFile(relPath)
        if (file != null) {
            call.respondText(file.readText(Charsets.UTF_8), ContentType.parse(contentType))
        } else {
            call.respond(HttpStatusCode.NotFound, "Not found")
        }
    }

    /** Resolve file within viewer/. Checks classpath resources first, then workspace shared/viewer/. */
    private fun resolveSharedFile(relPath: String): File? {
        // 1. Bundled viewer (inside JAR: /viewer/)
        val resource = this::class.java.getResourceAsStream("/viewer/$relPath")
        if (resource != null) {
            // Write to temp file for consistent File-based API
            val tempDir = File(System.getProperty("java.io.tmpdir"), "mcp-viewer-cache")
            tempDir.mkdirs()
            val cached = File(tempDir, relPath.replace("/", File.separator))
            if (!cached.exists()) {
                cached.parentFile?.mkdirs()
                cached.writeBytes(resource.readBytes())
            }
            resource.close()
            return cached
        }
        // 2. Fallback: workspace shared/viewer/ (dev mode)
        val file = File(config.workspace, "shared/viewer/$relPath")
        return if (file.exists()) file else null
    }

    /** Error page when shared/viewer/ files are missing. */
    private fun viewerErrorPage(filename: String): String {
        return "<!DOCTYPE html><html><head><title>Viewer Unavailable</title></head>" +
            "<body style='background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:2rem'>" +
            "<h1>Viewer Unavailable</h1>" +
            "<p>shared/viewer/$filename not found. Please ensure workspace is correct.</p>" +
            "<p style='opacity:.6;font-size:.8rem'>Workspace: ${config.workspace}</p></body></html>"
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
