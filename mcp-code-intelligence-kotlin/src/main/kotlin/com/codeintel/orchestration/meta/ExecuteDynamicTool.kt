/**
 * execute_dynamic_tool meta-tool — execute any registered tool by name.
 * Delegates to the main ToolDispatcher, enabling dynamic tool invocation.
 */
package com.codeintel.orchestration.meta

import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*

class ExecuteDynamicTool(private val engine: OrchestrationEngine) {

    /** Execute a tool by name with provided arguments. */
    fun execute(args: JsonObject): String {
        val toolName = args["tool_name"]?.jsonPrimitive?.content
            ?: return errorJson("Missing 'tool_name'")
        val toolArgs = args["arguments"]?.jsonObject ?: buildJsonObject {}
        val registry = engine.getRegistry()
        if (registry.find(toolName) == null) {
            return errorJson("Tool '$toolName' not found or disabled")
        }
        return try {
            runBlocking { engine.route(toolName, toolArgs) }
        } catch (e: Exception) {
            errorJson(e.message?.replace("\"", "'") ?: "Execution failed")
        }
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "execute_dynamic_tool")
        put("description", "Execute a tool on an upstream MCP server by exact tool name.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("tool_name") {
                    put("type", "string")
                    put("description", "Exact tool name to execute")
                }
                putJsonObject("arguments") {
                    put("type", "object")
                    put("description", "Arguments for the tool")
                }
            }
            putJsonArray("required") { add("tool_name") }
        }
    }

    private fun errorJson(msg: String) = """{"error":"$msg"}"""
}
