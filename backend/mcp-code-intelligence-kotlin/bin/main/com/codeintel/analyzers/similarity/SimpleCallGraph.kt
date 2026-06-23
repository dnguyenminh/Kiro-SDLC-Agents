/** Simple call graph backed by SQLite symbols + references. */
package com.codeintel.analyzers.similarity

import java.sql.Connection

/** Call graph implementation using symbol references from DB. */
class SimpleCallGraph(private val conn: Connection) : CallGraph {
    private val calleesCache = mutableMapOf<String, List<String>>()
    private val callersCache = mutableMapOf<String, List<String>>()

    override fun getCallees(nodeId: String): List<String> {
        return calleesCache.getOrPut(nodeId) { queryCallees(nodeId) }
    }

    override fun getCallers(nodeId: String): List<String> {
        return callersCache.getOrPut(nodeId) { emptyList() }
    }

    private fun queryCallees(nodeId: String): List<String> {
        val parts = nodeId.split(":", limit = 2)
        if (parts.size != 2) return emptyList()
        // Placeholder — full call graph requires graph engine integration
        return emptyList()
    }
}
