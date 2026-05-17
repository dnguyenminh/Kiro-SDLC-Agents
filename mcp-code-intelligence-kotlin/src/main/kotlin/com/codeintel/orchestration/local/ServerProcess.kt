/**
 * Single child MCP server process lifecycle — spawn, initialize, fetch tools, health check.
 * State machine: STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD.
 */
package com.codeintel.orchestration.local

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.orchestration.ServerEntry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*

enum class ServerState { STARTING, READY, ACTIVE, CRASHED, RESTARTING, STOPPING, DEAD, FAILED }

class ServerProcess(
    val name: String,
    private val entry: ServerEntry,
    private val scope: CoroutineScope
) {
    val rpc = StdioJsonRpc()
    var state: ServerState = ServerState.STARTING; private set
    var tools: List<JsonObject> = emptyList(); private set
    var retryCount: Int = 0; private set
    private var process: Process? = null

    /** Start the child process, initialize MCP handshake, fetch tools. */
    suspend fun start(): Boolean {
        state = ServerState.STARTING
        val proc = spawnProcess() ?: return markFailed("Failed to spawn process")
        process = proc
        attachRpc(proc)
        if (!initialize()) return markFailed("Initialize handshake failed")
        state = ServerState.READY
        if (!fetchTools()) return markFailed("Failed to fetch tools")
        state = ServerState.ACTIVE
        log("[$name] Active with ${tools.size} tools")
        return true
    }

    /** Stop the child process gracefully. */
    fun stop() {
        state = ServerState.STOPPING
        rpc.detach()
        destroyProcess()
        state = ServerState.DEAD
        log("[$name] Stopped")
    }

    /** Restart after crash — exponential backoff. */
    suspend fun restart(maxRetries: Int): Boolean {
        if (retryCount >= maxRetries) { state = ServerState.DEAD; return false }
        state = ServerState.RESTARTING
        retryCount++
        val backoffMs = (1000L * retryCount).coerceAtMost(10_000L)
        log("[$name] Restarting (attempt $retryCount/$maxRetries, backoff ${backoffMs}ms)")
        delay(backoffMs)
        destroyProcess()
        return start()
    }

    /** Call a tool on this child server via JSON-RPC. */
    suspend fun callTool(toolName: String, args: JsonObject, timeoutMs: Long): JsonElement? {
        val params = buildJsonObject {
            put("name", toolName)
            put("arguments", args)
        }
        return rpc.sendRequest("tools/call", params, timeoutMs)
    }

    /** Health check — send tools/list as ping, expect response within 5s. */
    suspend fun healthCheck(): Boolean {
        return try {
            rpc.sendRequest("tools/list", buildJsonObject {}, 5_000)
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Check if the OS process is still alive. */
    fun isAlive(): Boolean = process?.isAlive == true

    private fun spawnProcess(): Process? {
        return try {
            val args = buildChildArgs()
            val pb = ProcessBuilder(listOf(entry.command) + args)
            pb.environment().putAll(entry.env)
            pb.redirectErrorStream(false)
            pb.start()
        } catch (e: Exception) {
            log("[$name] Spawn failed: ${e.message}")
            null
        }
    }

    private fun buildChildArgs(): List<String> {
        val args = entry.args.toMutableList()
        if (args.contains("--config")) injectDepth(args)
        return args
    }

    private fun injectDepth(args: MutableList<String>) {
        val depthIdx = args.indexOf("--depth")
        if (depthIdx >= 0 && depthIdx + 1 < args.size) {
            args.removeAt(depthIdx + 1); args.removeAt(depthIdx)
        }
        val maxIdx = args.indexOf("--max-depth")
        if (maxIdx >= 0 && maxIdx + 1 < args.size) {
            args.removeAt(maxIdx + 1); args.removeAt(maxIdx)
        }
        args.addAll(listOf("--depth", "${Config.currentDepth + 1}"))
        args.addAll(listOf("--max-depth", "${Config.maxRecursionDepth}"))
    }

    private fun attachRpc(proc: Process) {
        val input = proc.inputStream.bufferedReader()
        val output = proc.outputStream
        rpc.attach(output, input, scope)
    }

    private suspend fun initialize(): Boolean {
        val params = buildJsonObject {
            put("protocolVersion", "2024-11-05")
            putJsonObject("capabilities") {}
            putJsonObject("clientInfo") {
                put("name", "mcp-orchestrator")
                put("version", "1.0.0")
            }
        }
        return try {
            rpc.sendRequest("initialize", params, entry.timeout)
            rpc.sendNotification("notifications/initialized", buildJsonObject {})
            true
        } catch (e: Exception) {
            log("[$name] Initialize failed: ${e.message}")
            false
        }
    }

    private suspend fun fetchTools(): Boolean {
        return try {
            val result = rpc.sendRequest("tools/list", buildJsonObject {}, entry.timeout)
            tools = parseToolsList(result)
            true
        } catch (e: Exception) {
            log("[$name] Fetch tools failed: ${e.message}")
            false
        }
    }

    private fun parseToolsList(result: JsonElement?): List<JsonObject> {
        val toolsArray = result?.jsonObject?.get("tools")?.jsonArray ?: return emptyList()
        return toolsArray.map { it.jsonObject }
    }

    private fun destroyProcess() {
        val proc = process ?: return
        if (proc.isAlive) {
            proc.destroyForcibly()
            proc.waitFor(3, java.util.concurrent.TimeUnit.SECONDS)
        }
        process = null
    }

    private fun markFailed(reason: String): Boolean {
        log("[$name] $reason")
        state = ServerState.FAILED
        return false
    }
}
