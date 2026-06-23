/**
 * Transport detection and server process interface.
 * Determines whether a server entry should use stdio or httpStream transport.
 */
package com.codeintel.orchestration.local

import com.codeintel.orchestration.ServerEntry
import com.codeintel.orchestration.TransportType
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/** Common interface for both stdio and httpStream server processes. */
interface IServerProcess {
    val name: String
    var state: ServerState
    var tools: List<JsonObject>
    var retryCount: Int
    suspend fun start(): Boolean
    fun stop()
    suspend fun restart(maxRetries: Int): Boolean
    suspend fun callTool(toolName: String, args: JsonObject, timeoutMs: Long): JsonElement?
    suspend fun healthCheck(): Boolean
    fun isAlive(): Boolean
}

/**
 * Detect transport type from server entry config.
 * - url present, no command → httpStream
 * - command present, no url → stdio
 * - both present → use transportType field (default httpStream)
 * - neither → stdio (will fail at spawn, preserves existing error behavior)
 */
fun detectTransport(entry: ServerEntry): TransportType {
    val hasUrl = !entry.url.isNullOrBlank()
    val hasCommand = !entry.command.isNullOrBlank()
    return when {
        hasUrl && !hasCommand -> TransportType.httpStream
        hasCommand && !hasUrl -> TransportType.stdio
        hasUrl && hasCommand -> if (entry.transportType == TransportType.stdio) TransportType.stdio else TransportType.httpStream
        else -> TransportType.stdio
    }
}
