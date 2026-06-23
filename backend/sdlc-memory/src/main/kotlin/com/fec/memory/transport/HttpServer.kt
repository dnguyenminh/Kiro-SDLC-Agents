package com.fec.memory.transport

import com.fec.memory.config.AppConfig
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

/**
 * HTTP server for Web Viewer and REST API.
 * Runs on configurable port (default 3200).
 */
class HttpServer(private val config: AppConfig) {

    suspend fun start() {
        logger.info { "HTTP server starting on port ${config.viewerPort}" }
        embeddedServer(Netty, port = config.viewerPort) {
            configurePlugins()
            configureRouting()
        }.start(wait = true)
    }

    private fun Application.configurePlugins() {
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = false
                encodeDefaults = true
                ignoreUnknownKeys = true
            })
        }
        install(CORS) {
            anyHost()
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Delete)
            allowHeader(HttpHeaders.ContentType)
        }
    }

    private fun Application.configureRouting() {
        routing {
            get("/api/health") {
                call.respond(mapOf(
                    "status" to "ok",
                    "version" to "0.1.0",
                    "workspace" to config.workspace.toString()
                ))
            }
        }
    }
}
