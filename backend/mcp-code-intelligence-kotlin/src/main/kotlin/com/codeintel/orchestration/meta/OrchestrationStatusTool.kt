/**
 * orchestration_status meta-tool — exposes orchestration state: servers, metrics,
 * depth, config path, and config watcher status. Task 27-28.
 */
package com.codeintel.orchestration.meta

import com.codeintel.Config
import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.serialization.json.*

class OrchestrationStatusTool(private val engine: OrchestrationEngine) {
    private val json = Json { encodeDefaults = true }

    /** Execute — returns full orchestration status as JSON. */
    fun execute(args: JsonObject): String {
        val status = buildJsonObject {
            put("enabled", engine.isEnabled())
            put("depth", Config.currentDepth)
            put("maxDepth", Config.maxRecursionDepth)
            put("configPath", Config.orchestrationConfigPath ?: "none")
            putJsonObject("configWatcher") { putWatcherStatus() }
            putJsonArray("servers") { addServerEntries() }
            putJsonObject("metrics") { addMetricsEntries() }
        }
        return json.encodeToString(JsonObject.serializer(), status)
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "orchestration_status")
        put("description", buildDescription())
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {}
        }
    }

    private fun buildDescription(): String {
        return "Show orchestration status: servers, tools, metrics, " +
            "depth, config path, and config watcher state."
    }

    private fun JsonObjectBuilder.putWatcherStatus() {
        val hasConfig = Config.orchestrationConfigPath != null
        put("active", hasConfig && engine.isEnabled())
        put("path", Config.orchestrationConfigPath ?: "none")
    }

    private fun JsonArrayBuilder.addServerEntries() {
        val serverStatus = engine.getServerStatus()
        for (info in serverStatus) {
            addJsonObject {
                put("name", info.name)
                put("state", info.state)
                put("toolCount", info.toolCount)
            }
        }
    }

    private fun JsonObjectBuilder.addMetricsEntries() {
        val metrics = engine.getMetrics()
        for ((tool, m) in metrics) {
            putJsonObject(tool) {
                put("calls", m.callCount)
                put("errors", m.errorCount)
                put("avgLatencyMs", computeAvgLatency(m.callCount, m.totalLatencyMs))
                put("lastCallAt", m.lastCallAt ?: 0L)
            }
        }
    }

    private fun computeAvgLatency(calls: Long, totalMs: Long): Long {
        return if (calls > 0) totalMs / calls else 0L
    }
}
