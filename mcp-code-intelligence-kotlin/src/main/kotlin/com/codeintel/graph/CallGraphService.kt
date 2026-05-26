/** Call Graph Service — BFS traversal for callers/callees. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.*
import java.sql.Connection
import java.util.ArrayDeque

class CallGraphService(
    private val conn: Connection,
    private val resolver: SymbolResolver,
) {

    /** Find all callers of a symbol with transitive depth. */
    fun findCallers(
        symbolName: String,
        depth: Int = 1,
        limit: Int = 20,
        fileFilter: String? = null,
        kindFilter: String = "calls",
    ): CallGraphResponse {
        val startTime = System.currentTimeMillis()
        val clampedDepth = depth.coerceIn(1, 5)

        val resolved = resolver.resolve(symbolName)
        if (resolved.isEmpty()) return symbolNotFound(symbolName)

        val results = mutableListOf<CallGraphItem>()
        val visited = mutableSetOf<Int>()
        val queue = ArrayDeque<Pair<String, Int>>()

        resolved.forEach { queue.add(it.name to 0) }

        while (queue.isNotEmpty() && results.size < limit) {
            val (current, currentDepth) = queue.poll()
            if (currentDepth >= clampedDepth) continue

            val callers = findCallersDb(current, kindFilter, limit - results.size)
            for (caller in callers) {
                if (caller.id in visited) continue
                visited.add(caller.id)

                val item = CallGraphItem(
                    symbol = caller.name,
                    qualifiedName = if (caller.parameters != null) "${caller.parameters}.${caller.name}" else caller.name,
                    kind = caller.kind,
                    filePath = caller.filePath,
                    definitionLine = caller.defLine,
                    callSiteLine = caller.callLine,
                    depthLevel = currentDepth + 1,
                    parameters = caller.parameters,
                    isAsync = caller.isAsync,
                )

                if (fileFilter != null && !matchFilter(item.filePath, fileFilter)) continue
                results.add(item)

                if (currentDepth + 1 < clampedDepth) {
                    queue.add(caller.name to currentDepth + 1)
                }
            }
        }

        val elapsed = System.currentTimeMillis() - startTime
        return CallGraphResponse(
            symbol = symbolName,
            resolvedTo = resolved.map { ResolvedTo(it.id, it.filePath, it.line, it.kind) },
            results = results,
            metadata = CallGraphMetadata(results.size, clampedDepth, results.size >= limit, elapsed),
        )
    }

    /** Find all callees of a symbol with transitive depth. */
    fun findCallees(
        symbolName: String,
        depth: Int = 1,
        limit: Int = 20,
        fileFilter: String? = null,
        includeExternal: Boolean = true,
    ): CallGraphResponse {
        val startTime = System.currentTimeMillis()
        val clampedDepth = depth.coerceIn(1, 5)

        val resolved = resolver.resolve(symbolName)
        if (resolved.isEmpty()) return symbolNotFound(symbolName)

        val results = mutableListOf<CallGraphItem>()
        val visited = mutableSetOf<String>()
        val queue = ArrayDeque<Pair<Int, Int>>()

        resolved.forEach { queue.add(it.id to 0) }

        while (queue.isNotEmpty() && results.size < limit) {
            val (symbolId, currentDepth) = queue.poll()
            if (currentDepth >= clampedDepth) continue

            val callees = findCalleesDb(symbolId, "calls", limit - results.size)
            for (callee in callees) {
                val key = "${callee.name}:${callee.callLine}"
                if (key in visited) continue
                visited.add(key)

                if (!includeExternal && callee.filePath == null) continue

                val item = CallGraphItem(
                    symbol = callee.name,
                    qualifiedName = callee.name,
                    kind = callee.kind ?: "unknown",
                    filePath = callee.filePath ?: "(external)",
                    definitionLine = callee.defLine ?: 0,
                    callSiteLine = callee.callLine,
                    depthLevel = currentDepth + 1,
                )

                if (fileFilter != null && item.filePath != "(external)" && !matchFilter(item.filePath, fileFilter)) continue
                results.add(item)

                if (callee.filePath != null && currentDepth + 1 < clampedDepth) {
                    val calleeResolved = resolver.resolve(callee.name)
                    calleeResolved.firstOrNull { it.filePath == callee.filePath }?.let {
                        queue.add(it.id to currentDepth + 1)
                    }
                }
            }
        }

        val elapsed = System.currentTimeMillis() - startTime
        return CallGraphResponse(
            symbol = symbolName,
            resolvedTo = resolved.map { ResolvedTo(it.id, it.filePath, it.line, it.kind) },
            results = results,
            metadata = CallGraphMetadata(results.size, clampedDepth, results.size >= limit, elapsed),
        )
    }

    private fun findCallersDb(symbolName: String, kind: String, limit: Int): List<CallerRow> {
        val stmt = conn.prepareStatement("""
            SELECT s.name, s.kind, s.file_path, s.start_line, r.line,
                   s.parent_symbol, s.visibility, s.id
            FROM relationships r
            JOIN symbols s ON s.id = r.source_symbol_id
            WHERE r.target_symbol = ? AND r.kind = ?
            ORDER BY s.file_path, r.line LIMIT ?
        """.trimIndent())
        stmt.setString(1, symbolName)
        stmt.setString(2, kind)
        stmt.setInt(3, limit)
        val rs = stmt.executeQuery()
        val rows = mutableListOf<CallerRow>()
        while (rs.next()) {
            rows.add(CallerRow(
                name = rs.getString(1),
                kind = rs.getString(2),
                filePath = rs.getString(3),
                defLine = rs.getInt(4),
                callLine = rs.getInt(5),
                parameters = rs.getString(6),
                isAsync = rs.getInt(7) == 1,
                id = rs.getInt(8),
            ))
        }
        return rows
    }

    private fun findCalleesDb(symbolId: Int, kind: String, limit: Int): List<CalleeRow> {
        val stmt = conn.prepareStatement("""
            SELECT r.target_symbol, r.line, r.metadata, ts.kind, ts.file_path, ts.start_line
            FROM relationships r
            LEFT JOIN symbols ts ON ts.id = r.target_symbol_id
            WHERE r.source_symbol_id = ? AND r.kind = ?
            ORDER BY r.line LIMIT ?
        """.trimIndent())
        stmt.setInt(1, symbolId)
        stmt.setString(2, kind)
        stmt.setInt(3, limit)
        val rs = stmt.executeQuery()
        val rows = mutableListOf<CalleeRow>()
        while (rs.next()) {
            rows.add(CalleeRow(
                name = rs.getString(1),
                callLine = rs.getInt(2),
                kind = rs.getString(4),
                filePath = rs.getString(5),
                defLine = rs.getInt(6).takeIf { !rs.wasNull() },
            ))
        }
        return rows
    }

    private fun symbolNotFound(symbolName: String) = CallGraphResponse(symbol = symbolName)

    private fun matchFilter(filePath: String, filter: String): Boolean {
        if ("*" in filter) {
            val regex = Regex("^" + Regex.escape(filter).replace("\\*", ".*") + "$")
            return regex.matches(filePath)
        }
        return filter in filePath
    }
}

private data class CallerRow(
    val name: String, val kind: String, val filePath: String,
    val defLine: Int, val callLine: Int, val parameters: String?,
    val isAsync: Boolean, val id: Int,
)

private data class CalleeRow(
    val name: String, val callLine: Int,
    val kind: String?, val filePath: String?, val defLine: Int?,
)
