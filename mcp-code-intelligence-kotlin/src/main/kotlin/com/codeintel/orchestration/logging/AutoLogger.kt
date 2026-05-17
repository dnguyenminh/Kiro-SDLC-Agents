/**
 * Auto-logger — logs every proxied tool call to the memory audit system.
 * Configurable exclusion list and arg truncation for privacy/size control.
 */
package com.codeintel.orchestration.logging

import com.codeintel.memory.MemoryEngine
import com.codeintel.orchestration.AutoLogConfig

class AutoLogger(
    private val memoryEngine: MemoryEngine?,
    private val settings: AutoLogConfig
) {
    /** Log a proxied tool call to audit trail. */
    fun logCall(
        toolName: String,
        args: String,
        result: String,
        latencyMs: Long,
        source: String,
        isError: Boolean = false
    ) {
        if (!settings.enabled) return
        if (toolName in settings.excludeTools) return
        val truncatedArgs = args.take(settings.maxArgLength)
        val operation = if (isError) "PROXY_ERROR" else "PROXY_CALL"
        val details = "$source::$toolName($truncatedArgs) → ${latencyMs}ms"
        memoryEngine?.audit?.log(
            operation = operation,
            sessionId = memoryEngine.currentSessionId,
            details = details
        )
        logAlertIfNeeded(toolName, source, latencyMs, isError)
    }

    private fun logAlertIfNeeded(toolName: String, source: String, latencyMs: Long, isError: Boolean) {
        if (!isError && latencyMs <= 5000) return
        val reason = if (isError) "ERROR" else "SLOW (${latencyMs}ms)"
        memoryEngine?.audit?.log(
            operation = "PROXY_ALERT",
            sessionId = memoryEngine.currentSessionId,
            details = "ALERT: $toolName from $source — $reason"
        )
    }
}
