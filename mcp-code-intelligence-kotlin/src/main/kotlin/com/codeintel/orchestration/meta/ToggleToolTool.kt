/**
 * toggle_tool meta-tool — enable or disable a specific tool or entire server for the session.
 * Session-scoped: toggles reset when the server restarts.
 */
package com.codeintel.orchestration.meta

import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.serialization.json.*

class ToggleToolTool(private val engine: OrchestrationEngine) {

    /** Toggle a tool or server on/off. */
    fun execute(args: JsonObject): String {
        val enabled = args["enabled"]?.jsonPrimitive?.booleanOrNull
            ?: return errorJson("Missing 'enabled' (boolean)")
        val toolName = args["tool_name"]?.jsonPrimitive?.content
        val serverName = args["server_name"]?.jsonPrimitive?.content
        if (toolName == null && serverName == null) {
            return errorJson("Provide 'tool_name' or 'server_name'")
        }
        val registry = engine.getRegistry()
        return if (toolName != null) {
            registry.toggle(toolName, enabled)
            successJson("Tool '$toolName' ${if (enabled) "enabled" else "disabled"}")
        } else {
            toggleServer(registry, serverName!!, enabled)
        }
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "toggle_tool")
        put("description", "Enable or disable a specific tool or an entire server for the current session.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("tool_name") {
                    put("type", "string")
                    put("description", "Name of the tool to toggle")
                }
                putJsonObject("server_name") {
                    put("type", "string")
                    put("description", "Name of the server to toggle (disables all its tools)")
                }
                putJsonObject("enabled") {
                    put("type", "boolean")
                    put("description", "Whether to enable or disable")
                }
            }
            putJsonArray("required") { add("enabled") }
        }
    }

    private fun toggleServer(registry: com.codeintel.orchestration.registry.UnifiedRegistry, server: String, enabled: Boolean): String {
        val prefix = "child:$server"
        val tools = registry.search("").filter { it.source == prefix }
        tools.forEach { registry.toggle(it.name, enabled) }
        return successJson("Server '$server' (${tools.size} tools) ${if (enabled) "enabled" else "disabled"}")
    }

    private fun errorJson(msg: String) = """{"error":"$msg"}"""
    private fun successJson(msg: String) = """{"success":true,"message":"$msg"}"""
}
