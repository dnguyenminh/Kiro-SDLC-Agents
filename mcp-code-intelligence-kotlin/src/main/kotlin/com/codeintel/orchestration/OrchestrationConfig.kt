/**
 * Orchestration config — data classes + JSON parser for orchestration.conf.
 * Config format matches Kiro mcp.json schema: {"mcpServers": {...}}.
 */
package com.codeintel.orchestration

import com.codeintel.log
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class OrchestrationConfig(
    val mcpServers: Map<String, ServerEntry> = emptyMap(),
    val settings: OrchSettings = OrchSettings()
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

        /** Load config from file path. Returns null if file doesn't exist or is invalid. */
        fun load(path: String): OrchestrationConfig? {
            val file = File(path)
            if (!file.exists()) {
                log("Orchestration config not found: $path")
                return null
            }
            return try {
                json.decodeFromString<OrchestrationConfig>(file.readText())
            } catch (e: Exception) {
                log("Failed to parse orchestration config: ${e.message}")
                null
            }
        }
    }

    /** Get only enabled server entries. */
    fun enabledServers(): Map<String, ServerEntry> =
        mcpServers.filter { !it.value.disabled }
}

@Serializable
data class ServerEntry(
    val command: String? = null,
    val args: List<String> = emptyList(),
    val env: Map<String, String> = emptyMap(),
    val url: String? = null,
    val transportType: TransportType? = null,
    val disabled: Boolean = false,
    val timeout: Long = 30_000
)

@Serializable
enum class TransportType { stdio, httpStream }

@Serializable
data class OrchSettings(
    val autoLog: AutoLogConfig = AutoLogConfig(),
    val healthCheckIntervalMs: Long = 30_000,
    val maxRestartRetries: Int = 3,
    val similarityThreshold: Double = 0.7,
    val maxRecursionDepth: Int = 3,
    val discoveryTimeoutMs: Long = 10_000,
    val kbSearchTimeoutMs: Long = 2_000
)

@Serializable
data class AutoLogConfig(
    val enabled: Boolean = true,
    val excludeTools: List<String> = emptyList(),
    val maxArgLength: Int = 200
)
