/**
 * JSON-RPC 2.0 over HTTP POST — sends requests to upstream httpStream MCP servers.
 * Handles both JSON and SSE response formats.
 * Manages Mcp-Session-Id header automatically.
 */
package com.codeintel.orchestration.local

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.atomic.AtomicLong

class HttpJsonRpc(private val url: String) {
    private val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
    private val nextId = AtomicLong(1)
    private var sessionId: String? = null
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** Send JSON-RPC request via HTTP POST and await response with timeout. */
    suspend fun sendRequest(method: String, params: JsonElement?, timeoutMs: Long): JsonElement? {
        val id = nextId.getAndIncrement()
        val body = buildRequestBody(id, method, params)
        val request = buildHttpRequest(body, timeoutMs)
        return withTimeout(timeoutMs) { executeRequest(request) }
    }

    /** Send JSON-RPC notification (fire-and-forget, no response expected). */
    fun sendNotification(method: String, params: JsonElement?) {
        val body = buildNotificationBody(method, params)
        val request = buildHttpRequest(body, 5_000)
        try { client.send(request, HttpResponse.BodyHandlers.discarding()) } catch (_: Exception) {}
    }

    private fun buildRequestBody(id: Long, method: String, params: JsonElement?): String {
        val obj = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", id)
            put("method", method)
            if (params != null) put("params", params)
        }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    private fun buildNotificationBody(method: String, params: JsonElement?): String {
        val obj = buildJsonObject {
            put("jsonrpc", "2.0")
            put("method", method)
            if (params != null) put("params", params)
        }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    private fun buildHttpRequest(body: String, timeoutMs: Long): HttpRequest {
        val builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofMillis(timeoutMs))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .POST(HttpRequest.BodyPublishers.ofString(body))
        sessionId?.let { builder.header("Mcp-Session-Id", it) }
        return builder.build()
    }

    private suspend fun executeRequest(request: HttpRequest): JsonElement? {
        val response = withContext(Dispatchers.IO) {
            client.send(request, HttpResponse.BodyHandlers.ofString())
        }
        captureSessionId(response)
        if (response.statusCode() !in 200..299) {
            throw RuntimeException("HTTP ${response.statusCode()}: ${response.body().take(200)}")
        }
        val contentType = response.headers().firstValue("content-type").orElse("")
        return if (contentType.contains("text/event-stream")) {
            parseSSE(response.body())
        } else {
            parseJsonResponse(response.body())
        }
    }

    private fun captureSessionId(response: HttpResponse<String>) {
        response.headers().firstValue("mcp-session-id").ifPresent { sessionId = it }
    }

    private fun parseJsonResponse(body: String): JsonElement? {
        val obj = json.parseToJsonElement(body).jsonObject
        val error = obj["error"]
        if (error != null && error != JsonNull) {
            val msg = error.jsonObject["message"]?.jsonPrimitive?.content ?: "Unknown error"
            throw RuntimeException(msg)
        }
        return obj["result"]
    }

    private fun parseSSE(text: String): JsonElement? {
        val lines = text.split("\n")
        for (i in lines.indices.reversed()) {
            val line = lines[i].trim()
            if (!line.startsWith("data:")) continue
            val dataStr = line.removePrefix("data:").trim()
            if (dataStr.isEmpty()) continue
            val obj = json.parseToJsonElement(dataStr).jsonObject
            val error = obj["error"]
            if (error != null && error != JsonNull) {
                val msg = error.jsonObject["message"]?.jsonPrimitive?.content ?: "Unknown error"
                throw RuntimeException(msg)
            }
            return obj["result"]
        }
        throw RuntimeException("No data in SSE response")
    }
}
