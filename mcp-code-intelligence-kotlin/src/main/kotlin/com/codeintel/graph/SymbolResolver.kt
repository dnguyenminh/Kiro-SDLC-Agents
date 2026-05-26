/** Symbol Resolver — resolves symbol names to database records. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.ResolvedSymbol
import java.sql.Connection

class SymbolResolver(private val conn: Connection) {

    /** Resolve a symbol name to one or more database records. */
    fun resolve(input: String): List<ResolvedSymbol> {
        // Strategy 1: Exact match
        val exact = exactMatch(input)
        if (exact.isNotEmpty()) return exact

        // Strategy 2: Qualified name (Class.method)
        if ("." in input) {
            val dotIdx = input.lastIndexOf('.')
            val parent = input.substring(0, dotIdx)
            val method = input.substring(dotIdx + 1)
            val qualified = qualifiedMatch(method, parent)
            if (qualified.isNotEmpty()) return qualified
        }

        // Strategy 3: file:symbol format
        if (":" in input) {
            val colonIdx = input.lastIndexOf(':')
            val filePart = input.substring(0, colonIdx)
            val namePart = input.substring(colonIdx + 1)
            val fileMatch = fileMatch(namePart, filePart)
            if (fileMatch.isNotEmpty()) return fileMatch
        }

        return emptyList()
    }

    /** Suggest similar symbol names. */
    fun suggest(input: String, limit: Int = 5): List<String> {
        val stmt = conn.prepareStatement(
            "SELECT DISTINCT name FROM symbols WHERE name LIKE ? LIMIT ?"
        )
        stmt.setString(1, "%$input%")
        stmt.setInt(2, limit)
        val rs = stmt.executeQuery()
        val names = mutableListOf<String>()
        while (rs.next()) names.add(rs.getString("name"))
        return names
    }

    private fun exactMatch(name: String): List<ResolvedSymbol> {
        val stmt = conn.prepareStatement("""
            SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, s.parent_symbol
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            WHERE s.name = ?
            ORDER BY s.start_line ASC
        """.trimIndent())
        stmt.setString(1, name)
        return extractResults(stmt.executeQuery())
    }

    private fun qualifiedMatch(method: String, parent: String): List<ResolvedSymbol> {
        val stmt = conn.prepareStatement("""
            SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, s.parent_symbol
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            JOIN symbols p ON p.id = CAST(s.parent_symbol AS INTEGER)
            WHERE s.name = ? AND p.name = ?
        """.trimIndent())
        stmt.setString(1, method)
        stmt.setString(2, parent)
        return extractResults(stmt.executeQuery())
    }

    private fun fileMatch(name: String, filePart: String): List<ResolvedSymbol> {
        val stmt = conn.prepareStatement("""
            SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, s.parent_symbol
            FROM symbols s
            JOIN files f ON s.file_id = f.id
            WHERE s.name = ? AND f.relative_path LIKE ?
        """.trimIndent())
        stmt.setString(1, name)
        stmt.setString(2, "%$filePart%")
        return extractResults(stmt.executeQuery())
    }

    private fun extractResults(rs: java.sql.ResultSet): List<ResolvedSymbol> {
        val results = mutableListOf<ResolvedSymbol>()
        while (rs.next()) {
            val parentStr = rs.getString("parent_symbol")
            val parentId = parentStr?.toIntOrNull()
            results.add(ResolvedSymbol(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                kind = rs.getString("kind"),
                filePath = rs.getString("relative_path"),
                line = rs.getInt("start_line"),
                parentSymbolId = parentId,
            ))
        }
        return results
    }
}
