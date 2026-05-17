/**
 * Orchestration engine — coordinator that wires LocalServerManager, SmartRouter,
 * UnifiedRegistry, and AutoLogger together. Entry point for orchestration layer.
 */
package com.codeintel.orchestration

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.memory.MemoryEngine
import com.codeintel.orchestration.local.LocalServerManager
import com.codeintel.orchestration.logging.AutoLogger
import com.codeintel.orchestration.registry.UnifiedRegistry
import com.codeintel.orchestration.routing.RoutingTable
import com.codeintel.orchestration.routing.SmartRouter
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class OrchestrationEngine(
    private val config: OrchestrationConfig,
    private val memoryEngine: MemoryEngine?,
    private val appConfig: Config
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val serverManager = LocalServerManager(config, scope)
    private val routingTable = RoutingTable()
    private val registry = UnifiedRegistry()
    private val router = SmartRouter(serverManager, routingTable)
    private val autoLogger = AutoLogger(memoryEngine, config.settings.autoLog)
    private var started = false

    /** Start orchestration — spawn all child servers, build routing table. */
    suspend fun start() {
        if (Config.currentDepth >= Config.maxRecursionDepth) {
            log("Max recursion depth reached (${Config.currentDepth}/${Config.maxRecursionDepth}). Orchestration disabled.")
            return
        }
        val count = serverManager.startAll()
        buildRoutingTable()
        started = true
        log("Orchestration started: $count/${config.enabledServers().size} servers active")
    }

    /** Stop orchestration — kill all child processes. */
    fun stop() {
        if (!started) return
        serverManager.stopAll()
        scope.cancel()
        started = false
        log("Orchestration stopped")
    }

    /** Route a tool call to the appropriate child server. */
    suspend fun route(toolName: String, args: JsonObject): String {
        if (!started) throw RuntimeException("Orchestration not started")
        val startTime = System.currentTimeMillis()
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

    /** Expose registry for meta-tools. */
    fun getRegistry(): UnifiedRegistry = registry

    private fun buildRoutingTable() {
        val childTools = serverManager.getAllTools()
        for ((serverName, toolDef) in childTools) {
            registry.setChildTools(serverName, serverManager.getAllTools()
                .filter { it.first == serverName }.map { it.second })
        }
        val childToolsByServer = registry.childToolsByServer()
        routingTable.rebuild(emptySet(), childToolsByServer)
    }

    private fun getTimeout(toolName: String): Long {
        val serverName = serverManager.findServerForTool(toolName) ?: return 30_000
        return config.mcpServers[serverName]?.timeout ?: 30_000
    }

    private fun resolveSource(toolName: String): String {
        return serverManager.findServerForTool(toolName) ?: "unknown"
    }
}
