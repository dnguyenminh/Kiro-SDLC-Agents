package com.fec.memory.transport

import com.fec.memory.config.AppConfig
import kotlinx.serialization.json.*
import mu.KotlinLogging
import java.io.BufferedReader
import java.io.InputStreamReader

private val logger = KotlinLogging.logger {}

private const val SERVER_NAME = "sdlc-memory"
private const val SERVER_VERSION = "0.1.0"
private const val PROTOCOL_VERSION = "2024-11-05"

/**
 * MCP server using stdio JSON-RPC 2.0 transport.
 */
class McpServer(private val config: AppConfig) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun run() {
        logger.info { "MCP stdio transport ready" }
        val reader = BufferedReader(InputStreamReader(System.`in`))
        reader.lineSequence().forEach { line ->
            if (line.isBlank()) return@forEach
            val response = handleRequest(line)
            if (response != null) {
                println(response)
                System.out.flush()
            }
        }
    }

    private fun handleRequest(line: String): String? {
        return try {
            val request = json.parseToJsonElement(line).jsonObject
            val method = request["method"]?.jsonPrimitive?.content ?: ""
            val id = request["id"]
            val params = request["params"]?.jsonObject ?: buildJsonObject {}

            if (id == null && method.startsWith("notifications/")) {
                return null
            }
            val result = dispatch(method, params)
            buildResponse(id, result)
        } catch (e: Exception) {
            logger.error(e) { "Request error" }
            buildErrorResponse(null, -32603, e.message ?: "Internal error")
        }
    }

    private fun dispatch(method: String, params: JsonObject): JsonElement {
        return when (method) {
            "initialize" -> handleInitialize(params)
            "tools/list" -> handleToolsList()
            "tools/call" -> handleToolsCall(params)
            "ping" -> buildJsonObject {}
            else -> throw McpError(-32601, "Method not found: $method")
        }
    }

    private fun handleInitialize(params: JsonObject): JsonElement {
        return buildJsonObject {
            put("protocolVersion", PROTOCOL_VERSION)
            putJsonObject("capabilities") {
                putJsonObject("tools") { put("listChanged", false) }
            }
            putJsonObject("serverInfo") {
                put("name", SERVER_NAME)
                put("version", SERVER_VERSION)
            }
        }
    }

    private fun handleToolsList(): JsonElement {
        return buildJsonObject {
            putJsonArray("tools") {
                // Tools will be registered by ToolRegistry
            }
        }
    }

    private fun handleToolsCall(params: JsonObject): JsonElement {
        val name = params["name"]?.jsonPrimitive?.content ?: ""
        val text = "Tool not implemented yet: $name"
        return buildJsonObject {
            putJsonArray("content") {
                addJsonObject {
                    put("type", "text")
                    put("text", text)
                }
            }
        }
    }

    private fun buildResponse(id: JsonElement?, result: JsonElement): String {
        val obj = buildJsonObject {
            put("jsonrpc", "2.0")
            if (id != null) put("id", id)
            put("result", result)
        }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    private fun buildErrorResponse(id: JsonElement?, code: Int, msg: String): String {
        val obj = buildJsonObject {
            put("jsonrpc", "2.0")
            if (id != null) put("id", id)
            putJsonObject("error") {
                put("code", code)
                put("message", msg)
            }
        }
        return json.encodeToString(JsonObject.serializer(), obj)
    }
}

private class McpError(val code: Int, override val message: String) : Exception(message)
