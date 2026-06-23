/**
 * O(1) tool-to-server routing table — maps tool names to their owning server.
 * Priority: native tools always win over child server tools.
 */
package com.codeintel.orchestration.routing

/** Routing destination for a tool call. */
data class RouteEntry(
    val toolName: String,
    val serverName: String,
    val isNative: Boolean
)

class RoutingTable {
    private val table = mutableMapOf<String, RouteEntry>()

    /** Rebuild routing table from native tool names + child server tools. */
    fun rebuild(nativeToolNames: Set<String>, childTools: Map<String, List<String>>) {
        table.clear()
        // Child tools first (lower priority — will be overwritten by native)
        for ((serverName, tools) in childTools) {
            for (toolName in tools) {
                table[toolName] = RouteEntry(toolName, serverName, isNative = false)
            }
        }
        // Native tools always win (highest priority)
        for (toolName in nativeToolNames) {
            table[toolName] = RouteEntry(toolName, "native", isNative = true)
        }
    }

    /** Resolve a tool name to its route. Returns null if tool not found. */
    fun resolve(toolName: String): RouteEntry? = table[toolName]

    /** Get all registered tool names. */
    fun allToolNames(): Set<String> = table.keys.toSet()

    /** Get all child (non-native) routes. */
    fun childRoutes(): List<RouteEntry> = table.values.filter { !it.isNative }

    /** Add a single route entry (for dynamically discovered nested tools). */
    fun addRoute(toolName: String, serverName: String) {
        if (!table.containsKey(toolName)) {
            table[toolName] = RouteEntry(toolName, serverName, isNative = false)
        }
    }

    /** Check if a tool exists in the routing table. */
    fun contains(toolName: String): Boolean = table.containsKey(toolName)

    /** Get count of registered tools. */
    fun size(): Int = table.size
}
