/**
 * MCP server — stdio JSON-RPC 2.0 transport for code intelligence.
 * Workspace is resolved from initialize request roots[0].uri.
 * Indexing is deferred until after initialize completes.
 */
package com.codeintel

import com.codeintel.db.DatabaseManager
import com.codeintel.indexer.IndexingEngine
import com.codeintel.indexer.FileWatcher
import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.embedding.EmbeddingFactory
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.tools.MemoryToolDefinitions
import com.codeintel.memory.tools.MemoryToolDispatcher
import com.codeintel.query.QueryLayer
import com.codeintel.tools.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*

private const val SERVER_NAME = "mcp-code-intelligence-kotlin"
private const val SERVER_VERSION = "0.1.0"
private const val PROTOCOL_VERSION = "2024-11-05"

class McpServer(args: Array<String> = emptyArray()) {
    private var config: Config
    private var db: DatabaseManager? = null
    private var indexer: IndexingEngine? = null
    private var queryLayer: QueryLayer? = null
    private var memoryEngine: MemoryEngine? = null
    private var memoryDispatcher: MemoryToolDispatcher? = null
    private var initialized = false
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    init {
        Config.setCliArgs(args)
        config = Config.load()
    }

    /** Main loop — read JSON-RPC from stdin, write to stdout. */
    fun run() {
        log("Server starting (workspace deferred until initialize)")
        val reader = System.`in`.bufferedReader()
        while (true) {
            val line = reader.readLine() ?: break
            if (line.isBlank()) continue
            val response = handleLine(line)
            if (response != null) send(response)
        }
        // Cleanup
        memoryEngine?.endSession()
        db?.close()
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

        // Notifications have no id — no response needed
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
        // Extract workspace from roots[0].uri
        val rootUri = extractRootUri(params)
        config = Config.withWorkspace(rootUri)
        log("Workspace: ${config.workspace}")
        log("DB path: ${config.dbPath}")

        // Initialize DB and indexer now
        val database = DatabaseManager(config.dbPath)
        database.initialize()
        db = database

        // Initialize memory engine
        val memory = MemoryEngine(database)
        memory.initialize()
        memoryEngine = memory

        // Initialize knowledge graph
        val knowledgeGraph = KnowledgeGraph(memory.graph)
        knowledgeGraph.loadFromDb()

        // Initialize memory tool dispatcher (try Ollama embeddings if configured)
        val embeddingService = EmbeddingFactory.create(config, memory.vectors)
        if (embeddingService != null) {
            log("✅ EmbeddingService initialized via Ollama (${config.ollamaModel})")
        } else {
            log("⚠️ EmbeddingService not available — vector search disabled, using BM25 only")
        }

        val engine = IndexingEngine(database, config)
        indexer = engine
        queryLayer = QueryLayer(database)

        memoryDispatcher = MemoryToolDispatcher(memory, embeddingService, knowledgeGraph, config.workspace, queryLayer)

        // Start memory session for this connection
        memory.startSession("mcp-client")

        // Wire memory engine into HTTP viewer (late binding)
        viewerServer?.memoryEngine = memory
        viewerServer?.knowledgeGraph = knowledgeGraph
        viewerServer?.embeddingService = embeddingService

        initialized = true

        // Run indexing in background thread (non-blocking)
        Thread {
            runBlocking {
                launch { engine.runFullIndex() }
                if (config.watchEnabled) {
                    launch { FileWatcher(config, engine).watch() }
                }
            }
        }.apply { isDaemon = true; start() }

        log("MCP server ready")

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

    private fun handleToolsList(): JsonObject = buildJsonObject {
        putJsonArray("tools") {
            ToolDefinitions.ALL.forEach { add(it) }
            MemoryToolDefinitions.ALL.forEach { add(it) }
        }
    }

    private fun handleToolsCall(params: JsonObject): JsonObject {
        if (!initialized) throw RuntimeException("Server not initialized")
        val name = params["name"]?.jsonPrimitive?.content ?: ""
        val args = params["arguments"]?.jsonObject ?: buildJsonObject {}
        // Log ALL tool calls to audit (for stream tab)
        memoryEngine?.audit?.log(
            "TOOL_CALL",
            sessionId = memoryEngine?.currentSessionId,
            details = "$name(${args.toString().take(150)})"
        )
        val text = dispatchTool(name, args)
        return buildJsonObject {
            putJsonArray("content") {
                addJsonObject { put("type", "text"); put("text", text) }
            }
        }
    }

    private fun dispatchTool(name: String, args: JsonObject): String {
        val ql = queryLayer ?: throw RuntimeException("Not initialized")
        val idx = indexer ?: throw RuntimeException("Not initialized")

        // Try memory tools first
        memoryDispatcher?.dispatch(name, args)?.let { return it }

        return when (name) {
            "code_search" -> CodeSearchTool(ql).execute(args)
            "code_symbols" -> CodeSymbolsTool(ql).execute(args)
            "code_context" -> CodeContextTool(ql, config.workspace).execute(args)
            "code_modules" -> CodeModulesTool(ql).execute(args)
            "code_index_status" -> CodeIndexStatusTool(ql, idx).execute(args)
            "stream_write_file" -> StreamWriteFileTool(config.workspace).execute(args)
            "code_kb_export" -> CodeKbExportTool(ql, config.workspace).execute(args)
            else -> "Unknown tool: $name"
        }
    }

    private fun extractRootUri(params: JsonObject): String? {
        val roots = params["roots"]?.jsonArray ?: return null
        if (roots.isEmpty()) return null
        val first = roots[0].jsonObject
        return first["uri"]?.jsonPrimitive?.content
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
