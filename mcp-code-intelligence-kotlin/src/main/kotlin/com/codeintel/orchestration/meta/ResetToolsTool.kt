/**
 * reset_tools meta-tool — reset all tool/server toggle states to default (all enabled).
 * Clears session-scoped toggles set by toggle_tool.
 */
package com.codeintel.orchestration.meta

import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.serialization.json.*

class ResetToolsTool(private val engine: OrchestrationEngine) {

    /** Reset all toggles to default enabled state. */
    fun execute(args: JsonObject): String {
        val serverName = args["server_name"]?.jsonPrimitive?.content
        val registry = engine.getRegistry()
        return if (serverName != null) {
            resetServer(registry, serverName)
        } else {
            registry.resetToggles()
            """{"success":true,"message":"All tool toggles reset to default"}"""
        }
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "reset_tools")
        put("description", "Reset all tool/server toggle states to their default enabled state for the session.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("server_name") {
                    put("type", "string")
                    put("description", "Optional. If provided, only resets tools for this server.")
                }
            }
        }
    }

    private fun resetServer(registry: com.codeintel.orchestration.registry.UnifiedRegistry, server: String): String {
        val prefix = "child:$server"
        val tools = registry.search("").filter { it.source == prefix }
        tools.forEach { registry.toggle(it.name, true) }
        return """{"success":true,"message":"Server '$server' tools reset (${tools.size} tools)"}"""
    }
}
