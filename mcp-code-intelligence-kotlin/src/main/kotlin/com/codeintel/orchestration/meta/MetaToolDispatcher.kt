/**
 * Meta-tool dispatcher — handles orchestrator-level tools (find, execute, toggle, reset, auto-approve).
 * Returns null if the tool name is not a meta-tool, allowing fallthrough to orchestration routing.
 */
package com.codeintel.orchestration.meta

import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.serialization.json.JsonObject

class MetaToolDispatcher(private val engine: OrchestrationEngine) {
    private val findTools = FindToolsTool(engine)
    private val executeDynamic = ExecuteDynamicTool(engine)
    private val toggleTool = ToggleToolTool(engine)
    private val resetTools = ResetToolsTool(engine)
    private val autoApprove = ManageAutoApproveTool(engine)

    /** Try to dispatch a meta-tool. Returns null if not a meta-tool. */
    fun dispatch(name: String, args: JsonObject): String? {
        return when (name) {
            "find_tools" -> findTools.execute(args)
            "execute_dynamic_tool" -> executeDynamic.execute(args)
            "toggle_tool" -> toggleTool.execute(args)
            "reset_tools" -> resetTools.execute(args)
            "manage_auto_approve" -> autoApprove.execute(args)
            else -> null
        }
    }

    /** Get all meta-tool definitions for tools/list response. */
    fun getToolDefinitions(): List<JsonObject> = listOf(
        findTools.definition(),
        executeDynamic.definition(),
        toggleTool.definition(),
        resetTools.definition(),
        autoApprove.definition()
    )
}
