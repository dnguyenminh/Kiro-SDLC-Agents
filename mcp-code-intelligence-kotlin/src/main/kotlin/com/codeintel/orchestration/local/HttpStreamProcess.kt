/**
 * httpStream MCP server process — connects to upstream MCP server via HTTP POST.
 * Same state machine as ServerProcess (stdio), but no child process spawning.
 */
package com.codeintel.orchestration.local

import com.codeintel.log
import com.codeintel.orchestration.ServerEntry
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*

class HttpStreamProcess(
    override val name: String,
    private val entry: ServerEntry
) : IServerProcess {
    override var state: ServerState = ServerState.STARTING
    override var tools: List<JsonObject> = emptyList()
    override var retryCount: Int = 0
    private var rpc = HttpJsonRpc(entry.url!!)

    /** Connect to httpStream server, initialize MCP handshake, fetch tools. */
    override suspend fun start(): Boolean {
        state = ServerState.STARTING
        log("[$name] Connecting to ${entry.url}")
        if (!initialize()) return markFailed("Initialize handshake failed at ${entry.url}")
        state = ServerState.READY
        if (!fetchTools()) return markFailed("Failed to fetch tools")
        state = ServerState.ACTIVE
        log("[$name] Active with ${tools.size} tools")
        return true
    }

    /** Stop — no process to kill, just mark dead. */
    override fun stop() {
        state = ServerState.DEAD
        log("[$name] Stopped")
    }

    /** Restart — re-create RPC client and re-initialize. */
    override suspend fun restart(maxRetries: Int): Boolean {
        if (retryCount >= maxRetries) { state = ServerState.DEAD; return false }
        state = ServerState.RESTARTING
        retryCount++
        val backoffMs = (1000L * retryCount).coerceAtMost(10_000L)
        log("[$name] Restarting (attempt $retryCount/$maxRetries, backoff ${backoffMs}ms)")
        delay(backoffMs)
        rpc = HttpJsonRpc(entry.url!!)
        return start()
    }

    /** Call a tool on this httpStream server via HTTP POST. */
    override suspend fun callTool(toolName: String, args: JsonObject, timeoutMs: Long): JsonElement? {
        val params = buildJsonObject {
            put("name", toolName)
            put("arguments", args)
        }
        return rpc.sendRequest("tools/call", params, timeoutMs)
    }

    /** Health check — send tools/list via HTTP, expect response within 5s. */
    override suspend fun healthCheck(): Boolean {
        return try {
            rpc.sendRequest("tools/list", buildJsonObject {}, 5_000)
            true
        } catch (_: Exception) { false }
    }

    /** No OS process — alive means state is ACTIVE. */
    override fun isAlive(): Boolean = state == ServerState.ACTIVE

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
            tools = result?.jsonObject?.get("tools")?.jsonArray?.map { it.jsonObject } ?: emptyList()
            true
        } catch (e: Exception) {
            log("[$name] Fetch tools failed: ${e.message}")
            false
        }
    }

    private fun markFailed(reason: String): Boolean {
        log("[$name] $reason")
        state = ServerState.FAILED
        return false
    }
}
