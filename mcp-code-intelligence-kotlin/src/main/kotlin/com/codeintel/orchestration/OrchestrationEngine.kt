/**
 * Orchestration engine — coordinator that wires LocalServerManager, SmartRouter,
 * UnifiedRegistry, AutoLogger, and ConfigWatcher together. Entry point for orchestration.
 * Child tools are hidden from tools/list — only accessible via find_tools/execute_dynamic_tool.
 */
package com.codeintel.orchestration

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.memory.MemoryEngine
import com.codeintel.orchestration.cache.AdaptiveTokenCache
import com.codeintel.orchestration.embedding.EmbeddingSearcher
import com.codeintel.orchestration.local.ConfigWatcher
import com.codeintel.orchestration.local.LocalServerManager
import com.codeintel.orchestration.local.ServerState
import com.codeintel.orchestration.local.ServerStatusInfo
import com.codeintel.orchestration.logging.AutoLogger
import com.codeintel.orchestration.meta.MetaToolDispatcher
import com.codeintel.orchestration.models.ModelManager
import com.codeintel.orchestration.registry.UnifiedRegistry
import com.codeintel.orchestration.routing.RoutingTable
import com.codeintel.orchestration.routing.SmartRouter
import com.codeintel.orchestration.routing.ToolMetrics
import kotlinx.coroutines.*
import kotlinx.serialization.json.*

class OrchestrationEngine(
    private var config: OrchestrationConfig,
    private val memoryEngine: MemoryEngine?,
    private val appConfig: Config
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val serverManager = LocalServerManager(config, scope)
    private val routingTable = RoutingTable()
    private val registry = UnifiedRegistry(config.settings.similarityThreshold)
    private val router = SmartRouter(serverManager, routingTable)
    private val autoLogger = AutoLogger(memoryEngine, config.settings.autoLog)
    private var configWatcher: ConfigWatcher? = null
    private var started = false
    private val findToolsDelegates = mutableListOf<String>()
    private val toolMapping = java.util.concurrent.ConcurrentHashMap<String, Pair<String, String>>()
    private var tokenCache: AdaptiveTokenCache? = null
    private var modelManager: ModelManager? = null
    private var embeddingSearcher: EmbeddingSearcher? = null

    val metaToolDispatcher: MetaToolDispatcher by lazy { MetaToolDispatcher(this) }

    /** Expose memory engine for KB search in find_tools. */
    fun getMemoryEngine(): MemoryEngine? = memoryEngine

    /** Lazy-init adaptive token cache. */
    fun getTokenCache(): AdaptiveTokenCache {
        if (tokenCache == null) {
            val cachePath = "${getWorkspace()}/.code-intel/token-cache.json"
            tokenCache = AdaptiveTokenCache(cachePath)
        }
        return tokenCache!!
    }

    /** Get embedding searcher (null if ONNX unavailable). */
    fun getEmbeddingSearcher(): EmbeddingSearcher? {
        if (embeddingSearcher == null) {
            embeddingSearcher = try {
                EmbeddingSearcher(getModelManager(), registry)
            } catch (_: Exception) { null }
        }
        return embeddingSearcher
    }

    /** Get model manager instance. */
    fun getModelManager(): ModelManager {
        if (modelManager == null) modelManager = ModelManager()
        return modelManager!!
    }

    /** Start orchestration — spawn all child servers, build routing table, ingest to KB. */
    suspend fun start() {
        if (Config.currentDepth >= Config.maxRecursionDepth) {
            log("Max depth (${Config.currentDepth}/${Config.maxRecursionDepth}). Orchestration disabled.")
            return
        }
        registry.setServerOrder(config.enabledServers().keys.toList())
        val count = serverManager.startAll()
        buildRoutingTable()
        ingestToolsToKb()
        started = true
        startConfigWatcher()
        log("Orchestration started: $count/${config.enabledServers().size} servers active")
    }

    /** Stop orchestration — kill all child processes and config watcher. */
    fun stop() {
        if (!started) return
        configWatcher?.stop()
        serverManager.stopAll()
        scope.cancel()
        started = false
        log("Orchestration stopped")
    }

    /** Route a tool call to the appropriate child server. */
    suspend fun route(toolName: String, args: JsonObject): String {
        if (!started) throw RuntimeException("Orchestration not started")
        val startTime = System.currentTimeMillis()
        router.requestStartTime = startTime
        return try {
            val result = router.route(toolName, args, getTimeout(toolName))
            val latency = System.currentTimeMillis() - startTime
            autoLogger.logCall(toolName, args.toString(), result, latency, resolveSource(toolName))
            result
        } catch (e: Exception) {
            val latency = System.currentTimeMillis() - startTime
            autoLogger.logCall(toolName, args.toString(), e.message ?: "", latency, "unknown", true)
            throw e
        }
    }

    /** Get all child server tools as JsonObject list (internal use only — NOT for tools/list). */
    fun getAllTools(): List<JsonObject> = registry.getAll()

    fun isEnabled(): Boolean = started

    fun getStatus(): JsonObject = buildJsonObject {
        put("enabled", started)
        put("depth", Config.currentDepth)
        put("maxDepth", Config.maxRecursionDepth)
        put("servers", serverManager.getStatus().size)
        put("hiddenTools", registry.allChildTools().size)
    }

    fun getServerStatus(): List<ServerStatusInfo> = serverManager.getServerStatusInfo()
    fun getMetrics(): Map<String, ToolMetrics> = router.getMetrics()
    fun getRegistry(): UnifiedRegistry = registry
    fun getChildServerNames(): List<String> =
        serverManager.getStatus().filter { it.value == ServerState.ACTIVE }.keys.toList()

    /** Get server names that have nested find_tools capability. */
    fun getFindToolsDelegates(): List<String> = findToolsDelegates

    /** Get (serverName, originalName) for a previously discovered nested tool. */
    fun getToolMapping(toolName: String): Pair<String, String>? = toolMapping[toolName]

    /** Register a tool discovered via nested find_tools delegation. */
    fun registerNestedTool(uniqueName: String, serverName: String, originalName: String, definition: JsonObject) {
        toolMapping[uniqueName] = serverName to originalName
        toolMapping[originalName] = serverName to originalName
        registry.registerNested(uniqueName, serverName, definition)
        routingTable.addRoute(originalName, serverName)
    }

    /** Retry FAILED servers and rebuild routing if any recover. */
    suspend fun retryFailedServers(): List<String> {
        val recovered = serverManager.retryFailedServers()
        if (recovered.isNotEmpty()) {
            buildRoutingTable()
            log("Recovered servers: $recovered — routing rebuilt")
        }
        return recovered
    }

    /** Call a tool directly on a specific child server (bypass routing table). */
    suspend fun callChild(serverName: String, toolName: String, args: JsonObject): String {
        val result = serverManager.callTool(serverName, toolName, args, 30_000)
        return extractText(result)
    }

    fun getWorkspace(): String = appConfig.workspace

    private fun extractText(result: JsonElement?): String {
        if (result == null) return "{}"
        val content = result.jsonObject["content"]?.jsonArray ?: return result.toString()
        val first = content.firstOrNull()?.jsonObject ?: return "{}"
        return first["text"]?.jsonPrimitive?.content ?: "{}"
    }

    private fun buildRoutingTable() {
        val allTools = serverManager.getAllTools()
        val byServer = allTools.groupBy({ it.first }, { it.second })
        for ((serverName, tools) in byServer) {
            registry.setChildTools(serverName, tools)
        }
        routingTable.rebuild(emptySet(), registry.childToolsByServer())
        buildDelegationList(allTools)
    }

    /** Identify child servers that expose find_tools/execute_dynamic_tool (nested orchestrators). */
    private fun buildDelegationList(allTools: List<Pair<String, JsonObject>>) {
        findToolsDelegates.clear()
        val serversWithFind = mutableSetOf<String>()
        for ((serverName, toolDef) in allTools) {
            val name = toolDef["name"]?.jsonPrimitive?.content ?: ""
            if (name == "find_tools") serversWithFind.add(serverName)
        }
        findToolsDelegates.addAll(serversWithFind)
        log("Delegation list: find_tools → $findToolsDelegates")
    }

    /** Ingest all child tool definitions into KB for searchability via find_tools. */
    private fun ingestToolsToKb() {
        val mem = memoryEngine ?: return
        val tools = registry.allChildTools()
        if (tools.isEmpty()) return
        val content = tools.joinToString("\n") { t ->
            val desc = t.definition["description"]?.jsonPrimitive?.content ?: ""
            "${t.name} [${t.source}]: $desc"
        }
        try {
            mem.knowledge.insert(
                com.codeintel.memory.models.KnowledgeEntry(
                    content = content,
                    summary = "Orchestration child tools registry (${tools.size} tools)",
                    type = "CONTEXT",
                    tier = "WORKING",
                    source = "orchestration-startup",
                    tags = "tools,registry,orchestration"
                )
            )
            log("Ingested ${tools.size} child tool definitions into KB")
        } catch (e: Exception) {
            log("Failed to ingest tools to KB: ${e.message}")
        }
    }

    private fun startConfigWatcher() {
        val path = Config.orchestrationConfigPath ?: return
        configWatcher = ConfigWatcher(path) { newConfig ->
            config = newConfig
            log("Config hot-reloaded, rebuilding routing table...")
            runBlocking { rebuildAfterReload(newConfig) }
        }
        configWatcher?.start()
    }

    private suspend fun rebuildAfterReload(newConfig: OrchestrationConfig) {
        serverManager.stopAll()
        serverManager.updateConfig(newConfig)
        registry.setServerOrder(newConfig.enabledServers().keys.toList())
        serverManager.startAll()
        buildRoutingTable()
        ingestToolsToKb()
    }

    private fun getTimeout(toolName: String): Long {
        val serverName = serverManager.findServerForTool(toolName) ?: return 30_000
        return config.mcpServers[serverName]?.timeout ?: 30_000
    }

    private fun resolveSource(toolName: String): String =
        serverManager.findServerForTool(toolName) ?: "unknown"
}
