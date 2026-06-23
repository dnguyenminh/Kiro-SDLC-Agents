/**
 * Smart router — resolves tool calls to the correct child server via RoutingTable,
 * then delegates execution to LocalServerManager. Collects per-tool metrics.
 * Supports timeout propagation: each hop subtracts elapsed time.
 */
package com.codeintel.orchestration.routing

import com.codeintel.orchestration.local.LocalServerManager
import kotlinx.serialization.json.*
import java.util.concurrent.ConcurrentHashMap

data class ToolMetrics(
    var callCount: Long = 0,
    var errorCount: Long = 0,
    var totalLatencyMs: Long = 0,
    var lastCallAt: Long? = null
)

class SmartRouter(
    private val serverManager: LocalServerManager,
    private val routingTable: RoutingTable
) {
    private val metrics = ConcurrentHashMap<String, ToolMetrics>()
    @Volatile var requestStartTime: Long = 0L

    /** Route a tool call with timeout propagation — subtracts elapsed time per hop. */
    suspend fun route(toolName: String, args: JsonObject, timeoutMs: Long = 30_000): String {
        val route = routingTable.resolve(toolName)
            ?: throw RuntimeException("Tool '$toolName' not found in any child server")
        if (route.isNative) {
            throw RuntimeException("Tool '$toolName' is native — should not reach router")
        }
        val remaining = computeRemainingTimeout(timeoutMs, route.serverName)
        val start = System.currentTimeMillis()
        return try {
            val result = serverManager.callTool(route.serverName, toolName, args, remaining)
            recordMetric(toolName, System.currentTimeMillis() - start, false)
            extractText(result)
        } catch (e: Exception) {
            recordMetric(toolName, System.currentTimeMillis() - start, true)
            throw RuntimeException(
                "Tool '$toolName' failed on server '${route.serverName}': ${e.message}", e
            )
        }
    }

    /** Get metrics for all tools that have been called. */
    fun getMetrics(): Map<String, ToolMetrics> = metrics.toMap()

    /** Compute remaining timeout by subtracting elapsed time since request start. */
    private fun computeRemainingTimeout(originalTimeoutMs: Long, serverName: String): Long {
        if (requestStartTime <= 0L) return originalTimeoutMs
        val elapsed = System.currentTimeMillis() - requestStartTime
        val remaining = originalTimeoutMs - elapsed
        if (remaining <= 0L) {
            throw RuntimeException(
                "Timeout exhausted before routing to server '$serverName' (elapsed: ${elapsed}ms)"
            )
        }
        return remaining
    }

    private fun extractText(result: JsonElement?): String {
        if (result == null) return "{}"
        val content = result.jsonObject["content"]?.jsonArray ?: return result.toString()
        val first = content.firstOrNull()?.jsonObject ?: return "{}"
        return first["text"]?.jsonPrimitive?.content ?: "{}"
    }

    private fun recordMetric(tool: String, latencyMs: Long, isError: Boolean) {
        val m = metrics.getOrPut(tool) { ToolMetrics() }
        m.callCount++
        if (isError) m.errorCount++
        m.totalLatencyMs += latencyMs
        m.lastCallAt = System.currentTimeMillis()
    }
}
