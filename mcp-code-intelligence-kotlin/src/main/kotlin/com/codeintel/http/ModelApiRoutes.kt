/**
 * HTTP routes for model management — list, download, status, switch.
 */
package com.codeintel.http

import com.codeintel.orchestration.models.ModelManager
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.*

fun Route.modelApiRoutes(modelManagerProvider: () -> ModelManager?) {
    route("/api/models") {
        get("/list") {
            val mgr = modelManagerProvider() ?: return@get call.respond(
                HttpStatusCode.ServiceUnavailable, mapOf("error" to "Model manager not initialized")
            )
            val result = mgr.execute(buildJsonObject { put("action", "list") })
            call.respondText(result, ContentType.Application.Json)
        }

        get("/status") {
            val mgr = modelManagerProvider() ?: return@get call.respond(
                HttpStatusCode.ServiceUnavailable, mapOf("error" to "Model manager not initialized")
            )
            val result = mgr.execute(buildJsonObject { put("action", "status") })
            call.respondText(result, ContentType.Application.Json)
        }

        post("/download") {
            val mgr = modelManagerProvider() ?: return@post call.respond(
                HttpStatusCode.ServiceUnavailable, mapOf("error" to "Model manager not initialized")
            )
            val body = call.receiveText()
            val args = buildJsonObject {
                put("action", "download")
                val parsed = Json.parseToJsonElement(body).jsonObject
                parsed.forEach { (k, v) -> put(k, v) }
            }
            val result = mgr.execute(args)
            val parsed = Json.parseToJsonElement(result).jsonObject
            val code = if (parsed["success"]?.jsonPrimitive?.booleanOrNull == true)
                HttpStatusCode.OK else HttpStatusCode.BadRequest
            call.respondText(result, ContentType.Application.Json, code)
        }

        post("/switch") {
            val mgr = modelManagerProvider() ?: return@post call.respond(
                HttpStatusCode.ServiceUnavailable, mapOf("error" to "Model manager not initialized")
            )
            val body = call.receiveText()
            val args = buildJsonObject {
                put("action", "switch")
                val parsed = Json.parseToJsonElement(body).jsonObject
                parsed.forEach { (k, v) -> put(k, v) }
            }
            val result = mgr.execute(args)
            val parsed = Json.parseToJsonElement(result).jsonObject
            val code = if (parsed["success"]?.jsonPrimitive?.booleanOrNull == true)
                HttpStatusCode.OK else HttpStatusCode.BadRequest
            call.respondText(result, ContentType.Application.Json, code)
        }
    }
}
