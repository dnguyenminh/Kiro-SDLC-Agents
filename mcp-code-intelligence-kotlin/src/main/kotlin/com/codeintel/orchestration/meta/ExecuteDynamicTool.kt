/**
 * execute_dynamic_tool meta-tool — execute any registered tool by name.
 * KSA-66: Routes via bridge's execute_dynamic_tool for nested tools (mapping check first).
 * Falls back to chain routing or direct routing if no mapping exists.
 */
package com.codeintel.orchestration.meta

import com.codeintel.log
import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*

class ExecuteDynamicTool(private val engine: OrchestrationEngine) {

    /** Execute a tool by name — mapping → chain → single routing. */
    fun execute(args: JsonObject): String {
        val toolName = args["tool_name"]?.jsonPrimitive?.content
            ?: return errorJson("Missing 'tool_name'")
        val toolArgs = args["arguments"]?.jsonObject ?: buildJsonObject {}
        return executeWithMapping(toolName, toolArgs)
    }

    /** Check mapping first (nested tools), then chain, then single. */
    private fun executeWithMapping(toolName: String, args: JsonObject): String {
        val mapping = engine.getToolMapping(toolName)
        if (mapping != null) return executeViaBridge(toolName, mapping, args)
        val chain = engine.getRegistry().getChain(toolName)
        if (chain != null) return executeChain(chain, toolName, args)
        if (engine.getRegistry().find(toolName) != null) return routeKnownTool(toolName, args)
        return tryAllChildren(toolName, args)
    }

    /** Execute via nested server's execute_dynamic_tool (bridge pattern). */
    private fun executeViaBridge(toolName: String, mapping: Pair<String, String>, args: JsonObject): String {
        val (serverName, originalName) = mapping
        val bridgeArgs = buildJsonObject {
            put("tool_name", originalName)
            put("arguments", args)
        }
        return try {
            val result = runBlocking {
                engine.callChild(serverName, "execute_dynamic_tool", bridgeArgs)
            }
            engine.getRegistry().recordHit(toolName, 1)
            if (!isErrorResult(result)) engine.getRegistry().recordHit(toolName, 3)
            result
        } catch (e: Exception) {
            errorJson("Nested execute failed on $serverName: ${e.message}")
        }
    }

    /** Execute through fallback chain — try each server in priority order. */
    private fun executeChain(
        chain: com.codeintel.orchestration.registry.ToolChain,
        toolName: String,
        args: JsonObject
    ): String {
        val errors = mutableListOf<String>()
        for (entry in chain.entries) {
            val actualName = entry.toolName ?: toolName
            val result = tryServer(entry.serverName, actualName, args)
            if (result != null) {
                log("[execute_dynamic_tool] $toolName succeeded on ${entry.serverName}")
                engine.getRegistry().recordHit(toolName, 1)
                if (!isErrorResult(result)) engine.getRegistry().recordHit(toolName, 3)
                return result
            }
            errors.add("${entry.serverName}: failed")
        }
        return errorJson("Tool '$toolName' failed on all ${chain.entries.size} servers: $errors")
    }

    private fun routeKnownTool(toolName: String, args: JsonObject): String {
        return try {
            val result = runBlocking { engine.route(toolName, args) }
            engine.getRegistry().recordHit(toolName, 1)
            if (!isErrorResult(result)) engine.getRegistry().recordHit(toolName, 3)
            result
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

    private fun isErrorResult(result: String): Boolean =
        result.trimStart().startsWith("{\"error\"") || "\"error\"" in result.take(100)

    private fun errorJson(msg: String) = """{"error":"$msg"}"""
}
