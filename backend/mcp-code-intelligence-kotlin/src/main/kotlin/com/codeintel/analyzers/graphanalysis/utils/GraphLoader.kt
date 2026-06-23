/**
 * KSA-163: Graph Loader — Loads subgraphs from the relationships table.
 */
package com.codeintel.analyzers.graphanalysis.utils

import com.codeintel.analyzers.graphanalysis.AdjacencyList
import com.codeintel.analyzers.graphanalysis.SymbolInfo
import java.sql.Connection

class GraphLoader(private val conn: Connection) {

    fun loadDependencyGraph(module: String? = null): AdjacencyList {
        val sql = buildString {
            append("SELECT source_symbol_id, target_symbol_id FROM relationships ")
            append("WHERE kind = 'imports' AND target_symbol_id IS NOT NULL ")
            append("AND file_path NOT LIKE '%node_modules%' AND file_path NOT LIKE '%vendor%' ")
            if (module != null) append("AND file_path LIKE ? ")
        }
        return loadGraph(sql, module)
    }

    fun loadCallGraph(module: String? = null): AdjacencyList {
        val sql = buildString {
            append("SELECT source_symbol_id, target_symbol_id FROM relationships ")
            append("WHERE kind = 'calls' AND target_symbol_id IS NOT NULL ")
            if (module != null) append("AND file_path LIKE ? ")
        }
        return loadGraph(sql, module)
    }

    fun loadReverseCallGraph(module: String? = null): AdjacencyList {
        val sql = buildString {
            append("SELECT source_symbol_id, target_symbol_id FROM relationships ")
            append("WHERE kind = 'calls' AND target_symbol_id IS NOT NULL ")
            if (module != null) append("AND file_path LIKE ? ")
        }
        val graph: AdjacencyList = mutableMapOf()
        conn.prepareStatement(sql).use { stmt ->
            module?.let { stmt.setString(1, "%$it%") }
            val rs = stmt.executeQuery()
            while (rs.next()) {
                val src = rs.getInt("source_symbol_id")
                val tgt = rs.getInt("target_symbol_id")
                graph.getOrPut(tgt) { mutableListOf() }.add(src) // reversed
                graph.getOrPut(src) { mutableListOf() }
            }
        }
        return graph
    }

    fun getSymbolInfo(symbolId: Int): SymbolInfo? {
        val sql = """
            SELECT s.id, s.name, s.kind, f.relative_path as filePath
            FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.id = ?
        """.trimIndent()
        conn.prepareStatement(sql).use { stmt ->
            stmt.setInt(1, symbolId)
            val rs = stmt.executeQuery()
            if (!rs.next()) return null
            return SymbolInfo(rs.getInt("id"), rs.getString("name"), rs.getString("kind"), rs.getString("filePath"))
        }
    }

    fun getSymbolInfoBatch(ids: List<Int>): Map<Int, SymbolInfo> {
        if (ids.isEmpty()) return emptyMap()
        val ph = ids.joinToString(",") { "?" }
        val sql = "SELECT s.id, s.name, s.kind, f.relative_path as filePath FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.id IN ($ph)"
        val map = mutableMapOf<Int, SymbolInfo>()
        conn.prepareStatement(sql).use { stmt ->
            ids.forEachIndexed { i, id -> stmt.setInt(i + 1, id) }
            val rs = stmt.executeQuery()
            while (rs.next()) {
                val info = SymbolInfo(rs.getInt("id"), rs.getString("name"), rs.getString("kind"), rs.getString("filePath"))
                map[info.id] = info
            }
        }
        return map
    }

    fun resolveSymbolId(name: String, filePath: String? = null): Int? {
        val sql = buildString {
            append("SELECT s.id FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.name = ? ")
            if (filePath != null) append("AND f.relative_path LIKE ? ")
            append("LIMIT 1")
        }
        conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, name)
            filePath?.let { stmt.setString(2, "%$it%") }
            val rs = stmt.executeQuery()
            return if (rs.next()) rs.getInt("id") else null
        }
    }

    private fun loadGraph(sql: String, module: String?): AdjacencyList {
        val graph: AdjacencyList = mutableMapOf()
        conn.prepareStatement(sql).use { stmt ->
            module?.let { stmt.setString(1, "%$it%") }
            val rs = stmt.executeQuery()
            while (rs.next()) {
                val src = rs.getInt("source_symbol_id")
                val tgt = rs.getInt("target_symbol_id")
                graph.getOrPut(src) { mutableListOf() }.add(tgt)
                graph.getOrPut(tgt) { mutableListOf() }
            }
        }
        return graph
    }
}
