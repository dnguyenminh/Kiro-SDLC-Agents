/**
 * NestedDetection — detect nested orchestrators in MCP tool lists.
 * Port of Node.js nested-detection logic (KSA-142).
 */
package com.codeintel.orchestration.nested

private val ORCHESTRATOR_MARKERS = listOf("find_tools", "execute_dynamic_tool")

/** Check if tool names contain orchestrator markers. */
fun isNestedOrchestrator(toolNames: List<String>): Boolean {
    return ORCHESTRATOR_MARKERS.any { it in toolNames }
}

/** Detect nested orchestrator on a server and log if found. */
fun detectNested(serverName: String, tools: List<Map<String, Any>>): Boolean {
    val names = tools.mapNotNull { it["name"] as? String }
    val isNested = isNestedOrchestrator(names)
    if (isNested) {
        System.err.println(
            "[orchestration] Nested orchestrator detected on '$serverName' — tools accessible via find_tools"
        )
    }
    return isNested
}
