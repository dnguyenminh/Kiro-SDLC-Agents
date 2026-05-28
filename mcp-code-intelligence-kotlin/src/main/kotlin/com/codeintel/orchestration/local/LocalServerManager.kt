/**
 * Manages multiple child MCP server processes — start, stop, health monitoring, tool routing.
 * Provides unified interface for calling tools on any child server.
 */
package com.codeintel.orchestration.local

import com.codeintel.log
import com.codeintel.orchestration.OrchestrationConfig
import com.codeintel.orchestration.TransportType
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/** Server status info for orchestration_status tool. */
data class ServerStatusInfo(val name: String, val state: String, val toolCount: Int)

class LocalServerManager(
    private var config: OrchestrationConfig,
    private val scope: CoroutineScope
) {
    private val servers = mutableMapOf<String, IServerProcess>()
    private var healthJob: Job? = null

    /** Update config reference (used by hot-reload). */
    fun updateConfig(newConfig: OrchestrationConfig) { config = newConfig }

    /** Start all enabled servers from config. Returns count of successfully started servers. */
    suspend fun startAll(): Int {
        val entries = config.enabledServers()
        log("Starting ${entries.size} child servers...")
        var started = 0
        for ((name, entry) in entries) {
            val transport = detectTransport(entry)
            val server: IServerProcess = if (transport == TransportType.httpStream) {
                HttpStreamProcess(name, entry)
            } else {
                ServerProcess(name, entry, scope)
            }
            servers[name] = server
            if (server.start()) started++ else log("[$name] Failed to start (transport: $transport)")
        }
        startHealthMonitor()
        return started
    }

    /** Stop all child servers gracefully. */
    fun stopAll() {
        healthJob?.cancel()
        servers.values.forEach { it.stop() }
        servers.clear()
        log("All child servers stopped")
    }

    /** Call a tool on the server that owns it. */
    suspend fun callTool(serverName: String, toolName: String, args: JsonObject, timeoutMs: Long): JsonElement? {
        val server = servers[serverName]
            ?: throw RuntimeException("Server '$serverName' not found (tool: '$toolName')")
        if (server.state != ServerState.ACTIVE) {
            throw RuntimeException(
                "Server '$serverName' is ${server.state} — cannot call tool '$toolName'"
            )
        }
        return server.callTool(toolName, args, timeoutMs)
    }

    /** Find which server owns a given tool name. Returns server name or null. */
    fun findServerForTool(toolName: String): String? {
        for ((name, server) in servers) {
            if (server.state != ServerState.ACTIVE) continue
            if (server.tools.any { it["name"]?.toString()?.trim('"') == toolName }) {
                return name
            }
        }
        return null
    }

    /** Get all tools from all active child servers. */
    fun getAllTools(): List<Pair<String, JsonObject>> {
        return servers.flatMap { (name, server) ->
            if (server.state == ServerState.ACTIVE) {
                server.tools.map { name to it }
            } else emptyList()
        }
    }

    /** Get status of all managed servers. */
    fun getStatus(): Map<String, ServerState> =
        servers.mapValues { it.value.state }

    /** Get detailed status info for each server (for orchestration_status tool). */
    fun getServerStatusInfo(): List<ServerStatusInfo> =
        servers.map { (name, server) ->
            ServerStatusInfo(name = name, state = server.state.name, toolCount = server.tools.size)
        }

    /** Retry starting servers that are in FAILED state. Returns names of recovered servers. */
    suspend fun retryFailedServers(): List<String> {
        val recovered = mutableListOf<String>()
        for ((name, server) in servers) {
            if (server.state != ServerState.FAILED) continue
            log("[$name] Retrying failed server...")
            if (server.start()) {
                recovered.add(name)
                log("[$name] Recovered — now active with ${server.tools.size} tools")
            } else {
                log("[$name] Still failing")
            }
        }
        return recovered
    }

    private fun startHealthMonitor() {
        val intervalMs = config.settings.healthCheckIntervalMs
        healthJob = scope.launch {
            while (isActive) {
                delay(intervalMs)
                checkHealth()
            }
        }
    }

    private suspend fun checkHealth() {
        for ((name, server) in servers) {
            if (server.state == ServerState.FAILED) {
                log("[$name] Health check: retrying failed server")
                if (server.start()) {
                    log("[$name] Recovered via health check")
                }
                continue
            }
            if (server.state != ServerState.ACTIVE) continue
            if (!server.isAlive()) {
                log("[$name] Process died — attempting restart")
                handleCrash(server)
            } else if (!server.healthCheck()) {
                log("[$name] Health check failed — attempting restart")
                handleCrash(server)
            }
        }
    }

    private suspend fun handleCrash(server: IServerProcess) {
        val maxRetries = config.settings.maxRestartRetries
        if (!server.restart(maxRetries)) {
            log("[${server.name}] Permanently dead after $maxRetries retries")
        }
    }
}
