/** BFS reachability analysis from entry points through call graph. */
package com.codeintel.analyzers.similarity

import java.util.ArrayDeque

/** Protocol for call graph access. */
interface CallGraph {
    /** Get all functions called by nodeId. */
    fun getCallees(nodeId: String): List<String>

    /** Get all functions that call nodeId. */
    fun getCallers(nodeId: String): List<String>
}

/** Compute reachable set from entry points via BFS on call graph. */
class ReachabilityAnalyzer(
    private val callGraph: CallGraph,
    private val entryPoints: List<String>
) {

    /** BFS from all entry points. Returns set of reachable node IDs. */
    fun computeReachable(): Set<String> {
        val visited = mutableSetOf<String>()
        val queue = ArrayDeque<String>(entryPoints)

        while (queue.isNotEmpty()) {
            val node = queue.poll()
            if (node in visited) continue
            visited.add(node)
            for (callee in callGraph.getCallees(node)) {
                if (callee !in visited) queue.add(callee)
            }
        }
        return visited
    }

    /** Return functions not reachable from any entry point. */
    fun getUnreachable(allFunctions: List<String>): List<String> {
        val reachable = computeReachable()
        return allFunctions.filter { it !in reachable }
    }
}
