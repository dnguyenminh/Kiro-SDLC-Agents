/**
 * execute_dynamic_tool meta-tool — execute any registered tool by name.
 * Uses fallback chain: if tool exists on multiple servers, tries in priority order.
 * If tool not in registry, tries forwarding to each child server (recursive discovery).
 */
package com.codeintel.orchestration.meta

import com.codeintel.log
import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*

class ExecuteDynamicTool(private val engine: OrchestrationEngine) {

    /** Execute a tool by name — uses chain routing with fallback. */
    fun execute(args: JsonObject): String {
        val toolName = args["tool_name"]?.jsonPrimitive?.content
            ?: return errorJson("Missing 'tool_name'")
        val toolArgs = args["arguments"]?.jsonObject ?: buildJsonObject {}
        return executeWithChain(toolName, toolArgs)
    }

    private fun executeWithChain(toolName: String, args: JsonObject): String {
        val registry = engine.getRegistry()
        val chain = registry.getChain(toolName)
        if (chain != null) return executeChain(chain, toolName, args)
        if (registry.find(toolName) != null) return routeKnownTool(toolName, args)
        return tryAllChildren(toolName, args)
    }

    /** Execute through fallback chain — try each server in priority order. */
    private fun executeChain(
        chain: com.codeintel.orchestration.registry.ToolChain,
        toolName: String,
        args: JsonObject
    ): String {
        for (entry in chain.entries) {
            val result = tryServer(entry.serverName, toolName, args)
            if (result != null) {
                log("[execute_dynamic_tool] $toolName succeeded on ${entry.serverName}")
                return result
            }
        }
        return errorJson("Tool '$toolName' failed on all ${chain.entries.size} servers in chain")
    }

    private fun routeKnownTool(toolName: String, args: JsonObject): String {
        return try {
            runBlocking { engine.route(toolName, args) }
        } catch (e: Exception) {
            errorJson(e.message?.replace("\"", "'") ?: "Execution failed")
        }
    }

    private fun tryAllChildren(toolName: String, args: JsonObject): String {
        val servers = engine.getChildServerNames()
        for (server in servers) {
            val result = tryServer(server, toolName, args)
            if (result != null) return result
        }
        return errorJson("Tool '$toolName' not found in any server")
    }

    private fun tryServer(server: String, toolName: String, args: JsonObject): String? {
        return try {
            runBlocking { engine.callChild(server, toolName, args) }
        } catch (e: Exception) { null }
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
