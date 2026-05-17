/**
 * Smart router — resolves tool calls to the correct child server via RoutingTable,
 * then delegates execution to LocalServerManager. Collects per-tool metrics.
 */
package com.codeintel.orchestration.routing

import com.codeintel.orchestration.local.LocalServerManager
import kotlinx.coroutines.runBlocking
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

    /** Route a tool call to the correct child server. Returns result text. */
    suspend fun route(toolName: String, args: JsonObject, timeoutMs: Long = 30_000): String {
        val route = routingTable.resolve(toolName)
            ?: throw RuntimeException("Tool '$toolName' not found in any child server")
        if (route.isNative) {
            throw RuntimeException("Tool '$toolName' is native — should not reach router")
        }
        val start = System.currentTimeMillis()
        return try {
            val result = serverManager.callTool(route.serverName, toolName, args, timeoutMs)
            val latency = System.currentTimeMillis() - start
            recordMetric(toolName, latency, isError = false)
            extractText(result)
        } catch (e: Exception) {
            val latency = System.currentTimeMillis() - start
            recordMetric(toolName, latency, isError = true)
            throw e
        }
    }

    /** Get metrics for all tools that have been called. */
    fun getMetrics(): Map<String, ToolMetrics> = metrics.toMap()

    /** Extract text content from MCP tools/call response format. */
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
