/**
 * Orchestration engine — coordinator that wires LocalServerManager, SmartRouter,
 * UnifiedRegistry, AutoLogger, and ConfigWatcher together. Entry point for orchestration.
 */
package com.codeintel.orchestration

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.memory.MemoryEngine
import com.codeintel.orchestration.local.ConfigWatcher
import com.codeintel.orchestration.local.LocalServerManager
import com.codeintel.orchestration.local.ServerStatusInfo
import com.codeintel.orchestration.logging.AutoLogger
import com.codeintel.orchestration.meta.MetaToolDispatcher
import com.codeintel.orchestration.registry.UnifiedRegistry
import com.codeintel.orchestration.routing.RoutingTable
import com.codeintel.orchestration.routing.SmartRouter
import com.codeintel.orchestration.routing.ToolMetrics
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class OrchestrationEngine(
    private var config: OrchestrationConfig,
    private val memoryEngine: MemoryEngine?,
    private val appConfig: Config
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val serverManager = LocalServerManager(config, scope)
    private val routingTable = RoutingTable()
    private val registry = UnifiedRegistry()
    private val router = SmartRouter(serverManager, routingTable)
    private val autoLogger = AutoLogger(memoryEngine, config.settings.autoLog)
    private var configWatcher: ConfigWatcher? = null
    private var started = false

    /** Meta-tool dispatcher — initialized lazily after engine starts. */
    val metaToolDispatcher: MetaToolDispatcher by lazy { MetaToolDispatcher(this) }

    /** Start orchestration — spawn all child servers, build routing table, start watcher. */
    suspend fun start() {
        if (Config.currentDepth >= Config.maxRecursionDepth) {
            log("Max depth (${Config.currentDepth}/${Config.maxRecursionDepth}). Orchestration disabled.")
            return
        }
        val count = serverManager.startAll()
        buildRoutingTable()
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

    /** Get all child server tools as JsonObject list (for tools/list response). */
    fun getAllTools(): List<JsonObject> = registry.getAll()

    /** Check if orchestration is active. */
    fun isEnabled(): Boolean = started

    /** Get orchestration status as JSON. */
    fun getStatus(): JsonObject = buildJsonObject {
        put("enabled", started)
        put("depth", Config.currentDepth)
        put("maxDepth", Config.maxRecursionDepth)
        put("servers", serverManager.getStatus().size)
    }

    /** Get per-server status info (name, state, tool count). */
    fun getServerStatus(): List<ServerStatusInfo> =
        serverManager.getServerStatusInfo()

    /** Get per-tool metrics from the router. */
    fun getMetrics(): Map<String, ToolMetrics> =
        router.getMetrics()

    /** Expose registry for meta-tools. */
    fun getRegistry(): UnifiedRegistry = registry

    /** Expose workspace path for ManageAutoApproveTool. */
    fun getWorkspace(): String = appConfig.workspace

    private fun buildRoutingTable() {
        val allTools = serverManager.getAllTools()
        val byServer = allTools.groupBy({ it.first }, { it.second })
        for ((serverName, tools) in byServer) {
            registry.setChildTools(serverName, tools)
        }
        routingTable.rebuild(emptySet(), registry.childToolsByServer())
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
        serverManager.startAll()
        buildRoutingTable()
    }

    private fun getTimeout(toolName: String): Long {
        val serverName = serverManager.findServerForTool(toolName) ?: return 30_000
        return config.mcpServers[serverName]?.timeout ?: 30_000
    }

    private fun resolveSource(toolName: String): String {
        return serverManager.findServerForTool(toolName) ?: "unknown"
    }
}
