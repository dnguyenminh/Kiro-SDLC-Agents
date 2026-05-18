/**
 * MCP server — stdio JSON-RPC 2.0 transport for code intelligence.
 * Workspace is resolved from initialize request roots[0].uri.
 * Indexing is deferred until after initialize completes.
 */
package com.codeintel

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.tools.MemoryToolDefinitions
import com.codeintel.orchestration.OrchestrationEngine
import com.codeintel.tools.ToolDefinitions
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*

private const val SERVER_NAME = "mcp-code-intelligence-kotlin"
private const val SERVER_VERSION = "0.1.0"
private const val PROTOCOL_VERSION = "2024-11-05"

class McpServer(args: Array<String> = emptyArray()) {
    private var config: Config
    private var memoryEngine: MemoryEngine? = null
    private var orchestrationEngine: OrchestrationEngine? = null
    private var toolDispatcher: ToolDispatcher? = null
    private var initialized = false
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    init {
        Config.setCliArgs(args)
        config = Config.load()
    }

    /** Main loop — read JSON-RPC from stdin, write to stdout. */
    fun run() {
        log("Server starting (workspace deferred until initialize)")
        Runtime.getRuntime().addShutdownHook(Thread { shutdown() })
        val reader = System.`in`.bufferedReader()
        while (true) {
            val line = reader.readLine() ?: break
            if (line.isBlank()) continue
            val response = handleLine(line)
            if (response != null) send(response)
        }
        shutdown()
    }

    private fun shutdown() {
        viewerServer?.stop()
        runBlocking { orchestrationEngine?.stop() }
        memoryEngine?.endSession()
        log("Server shutdown complete")
    }

    private fun handleLine(line: String): JsonObject? {
        val request = try {
            json.parseToJsonElement(line).jsonObject
        } catch (e: Exception) {
            return errorResponse(JsonNull, -32700, "Parse error")
        }
        return handleRequest(request)
    }

    private fun handleRequest(request: JsonObject): JsonObject? {
        val method = request["method"]?.jsonPrimitive?.content ?: ""
        val reqId = request["id"] ?: JsonNull
        val params = request["params"]?.jsonObject ?: buildJsonObject {}
        if (reqId == JsonNull && method.startsWith("notifications/")) return null
        return dispatch(method, reqId, params)
    }

    private fun dispatch(method: String, id: JsonElement, params: JsonObject): JsonObject {
        return try {
            val result = when (method) {
                "initialize" -> handleInitialize(params)
                "tools/list" -> handleToolsList()
                "tools/call" -> handleToolsCall(params)
                "ping" -> buildJsonObject {}
                else -> return errorResponse(id, -32601, "Method not found: $method")
            }
            successResponse(id, result)
        } catch (e: Exception) {
            errorResponse(id, -32603, e.message ?: "Internal error")
        }
    }

    private fun handleInitialize(params: JsonObject): JsonObject {
        val rootUri = extractRootUri(params)
        config = Config.withWorkspace(rootUri)
        log("Workspace: ${config.workspace}")
        val result = initializeServer(config)
        memoryEngine = result.memoryEngine
        orchestrationEngine = result.orchestrationEngine
        toolDispatcher = ToolDispatcher(
            config, result.queryLayer, result.indexer,
            result.memoryDispatcher, result.orchestrationEngine
        )
        initialized = true
        log("MCP server ready")
        return buildInitResponse()
    }

    private fun handleToolsList(): JsonObject = buildJsonObject {
        putJsonArray("tools") {
            ToolDefinitions.ALL.forEach { add(it) }
            MemoryToolDefinitions.ALL.forEach { add(it) }
            orchestrationEngine?.metaToolDispatcher?.getToolDefinitions()?.forEach { add(it) }
            // Child tools NOT exposed — accessed only via find_tools/execute_dynamic_tool
        }
    }

    private fun handleToolsCall(params: JsonObject): JsonObject {
        if (!initialized) throw RuntimeException("Server not initialized")
        val name = params["name"]?.jsonPrimitive?.content ?: ""
        val args = params["arguments"]?.jsonObject ?: buildJsonObject {}
        memoryEngine?.audit?.log(
            "TOOL_CALL",
            sessionId = memoryEngine?.currentSessionId,
            details = "$name(${args.toString().take(150)})"
        )
        val text = toolDispatcher?.dispatch(name, args) ?: "Unknown tool: $name"
        return buildJsonObject {
            putJsonArray("content") {
                addJsonObject { put("type", "text"); put("text", text) }
            }
        }
    }

    private fun buildInitResponse(): JsonObject = buildJsonObject {
        put("protocolVersion", PROTOCOL_VERSION)
        putJsonObject("capabilities") {
            putJsonObject("tools") { put("listChanged", false) }
        }
        putJsonObject("serverInfo") {
            put("name", SERVER_NAME)
            put("version", SERVER_VERSION)
        }
    }

    private fun extractRootUri(params: JsonObject): String? {
        val roots = params["roots"]?.jsonArray ?: return null
        if (roots.isEmpty()) return null
        return roots[0].jsonObject["uri"]?.jsonPrimitive?.content
    }

    private fun successResponse(id: JsonElement, result: JsonObject) = buildJsonObject {
        put("jsonrpc", "2.0")
        put("id", id)
        put("result", result)
    }

    private fun errorResponse(id: JsonElement, code: Int, message: String) = buildJsonObject {
        put("jsonrpc", "2.0")
        put("id", id)
        putJsonObject("error") { put("code", code); put("message", message) }
    }

    private fun send(response: JsonObject) {
        println(response.toString())
        System.out.flush()
    }
}
