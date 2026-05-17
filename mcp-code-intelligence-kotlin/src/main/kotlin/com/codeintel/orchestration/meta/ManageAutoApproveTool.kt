/**
 * manage_auto_approve meta-tool — add or remove tools from the auto-approve list.
 * Persists to .code-intel/auto-approve.json so it survives restarts.
 */
package com.codeintel.orchestration.meta

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.serialization.json.*
import java.io.File

class ManageAutoApproveTool(private val engine: OrchestrationEngine) {
    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }

    /** Add or remove a tool/server from auto-approve list. */
    fun execute(args: JsonObject): String {
        val autoApprove = args["auto_approve"]?.jsonPrimitive?.booleanOrNull
            ?: return """{"error":"Missing 'auto_approve' (boolean)"}"""
        val toolName = args["tool_name"]?.jsonPrimitive?.content
        val serverName = args["server_name"]?.jsonPrimitive?.content
        if (toolName == null && serverName == null) {
            return """{"error":"Provide 'tool_name' or 'server_name'"}"""
        }
        val list = loadList().toMutableSet()
        val target = toolName ?: "server:$serverName"
        if (autoApprove) list.add(target) else list.remove(target)
        saveList(list)
        val action = if (autoApprove) "added to" else "removed from"
        return """{"success":true,"message":"'$target' $action auto-approve list"}"""
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "manage_auto_approve")
        put("description", "Add or remove tools from the auto-approve list (persists across restarts).")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("tool_name") {
                    put("type", "string")
                    put("description", "Name of the tool to update")
                }
                putJsonObject("server_name") {
                    put("type", "string")
                    put("description", "Name of the server (if updating all tools of a server)")
                }
                putJsonObject("auto_approve") {
                    put("type", "boolean")
                    put("description", "Whether to add or remove from auto-approve list")
                }
            }
            putJsonArray("required") { add("auto_approve") }
        }
    }

    private fun getFile(): File {
        val dir = File(engine.getWorkspace(), ".code-intel")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, "auto-approve.json")
    }

    private fun loadList(): Set<String> {
        val file = getFile()
        if (!file.exists()) return emptySet()
        return try {
            val arr = json.parseToJsonElement(file.readText()).jsonArray
            arr.map { it.jsonPrimitive.content }.toSet()
        } catch (e: Exception) {
            log("Failed to read auto-approve.json: ${e.message}")
            emptySet()
        }
    }

    private fun saveList(list: Set<String>) {
        val arr = buildJsonArray { list.forEach { add(it) } }
        getFile().writeText(json.encodeToString(JsonArray.serializer(), arr))
    }
}
