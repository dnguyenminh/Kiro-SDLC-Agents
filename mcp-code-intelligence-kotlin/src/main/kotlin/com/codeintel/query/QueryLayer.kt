/** Query layer — FTS5 search, symbol lookup, module listing. */
package com.codeintel.query

import com.codeintel.db.DatabaseManager

data class SearchResult(
    val name: String, val kind: String, val signature: String?,
    val filePath: String, val startLine: Int, val endLine: Int,
    val docComment: String?
)

data class SymbolResult(
    val name: String, val kind: String, val signature: String?,
    val filePath: String, val startLine: Int, val endLine: Int,
    val visibility: String?, val docComment: String?, val parentSymbol: String?
)

data class ModuleResult(
    val name: String, val rootPath: String, val language: String?,
    val description: String?, val fileCount: Int, val symbolCount: Int,
    val diStyle: String?, val errorHandling: String?,
    val namingConvention: String?, val loggingFramework: String?,
    val testingFramework: String?, val purpose: String?
)

data class IndexStatus(
    val totalFiles: Int, val totalSymbols: Int, val totalModules: Int,
    val lastIndexed: String?, val languages: Map<String, Int>
)

class QueryLayer(private val db: DatabaseManager) {

    /** Full-text search across symbols using FTS5. */
    fun searchCode(query: String, limit: Int = 20): List<SearchResult> {
        val ftsQuery = sanitizeFtsQuery(query)
        val sql = """
            SELECT s.name, s.kind, s.signature, f.relative_path,
                   s.start_line, s.end_line, s.doc_comment
            FROM symbols_fts
            JOIN symbols s ON symbols_fts.rowid = s.id
            JOIN files f ON s.file_id = f.id
            WHERE symbols_fts MATCH ?
            ORDER BY rank LIMIT ?
        """.trimIndent()
        val results = mutableListOf<SearchResult>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, ftsQuery)
            stmt.setInt(2, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                results.add(SearchResult(
                    name = rs.getString(1), kind = rs.getString(2),
                    signature = rs.getString(3), filePath = rs.getString(4),
                    startLine = rs.getInt(5), endLine = rs.getInt(6),
                    docComment = rs.getString(7)
                ))
            }
        }
        return results
    }

    /** Lookup symbols by name prefix. */
    fun findSymbols(name: String, kind: String?, limit: Int = 50): List<SymbolResult> {
        val sb = StringBuilder("""
            SELECT s.name, s.kind, s.signature, f.relative_path,
                   s.start_line, s.end_line, s.visibility, s.doc_comment, s.parent_symbol
            FROM symbols s JOIN files f ON s.file_id = f.id
            WHERE s.name LIKE ?
        """.trimIndent())
        val params = mutableListOf("$name%")
        if (kind != null) { sb.append(" AND s.kind = ?"); params.add(kind) }
        sb.append(" ORDER BY s.name LIMIT ?")
        val results = mutableListOf<SymbolResult>()
        db.conn.prepareStatement(sb.toString()).use { stmt ->
            params.forEachIndexed { i, v -> stmt.setString(i + 1, v) }
            stmt.setInt(params.size + 1, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                results.add(SymbolResult(
                    name = rs.getString(1), kind = rs.getString(2),
                    signature = rs.getString(3), filePath = rs.getString(4),
                    startLine = rs.getInt(5), endLine = rs.getInt(6),
                    visibility = rs.getString(7), docComment = rs.getString(8),
                    parentSymbol = rs.getString(9)
                ))
            }
        }
        return results
    }

    /** Get symbols in a specific file. */
    fun getFileSymbols(relativePath: String): List<SymbolResult> {
        val sql = """
            SELECT s.name, s.kind, s.signature, f.relative_path,
                   s.start_line, s.end_line, s.visibility, s.doc_comment, s.parent_symbol
            FROM symbols s JOIN files f ON s.file_id = f.id
            WHERE f.relative_path = ? ORDER BY s.start_line
        """.trimIndent()
        val results = mutableListOf<SymbolResult>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, relativePath)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                results.add(SymbolResult(
                    name = rs.getString(1), kind = rs.getString(2),
                    signature = rs.getString(3), filePath = rs.getString(4),
                    startLine = rs.getInt(5), endLine = rs.getInt(6),
                    visibility = rs.getString(7), docComment = rs.getString(8),
                    parentSymbol = rs.getString(9)
                ))
            }
        }
        return results
    }

    /** List all modules with stats and pattern metadata. */
    fun listModules(): List<ModuleResult> {
        val sql = """SELECT name, root_path, language, description, file_count, symbol_count,
            di_style, error_handling, naming_convention,
            logging_framework, testing_framework, purpose
            FROM modules ORDER BY name"""
        val results = mutableListOf<ModuleResult>()
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(sql)
            while (rs.next()) {
                results.add(ModuleResult(
                    name = rs.getString(1), rootPath = rs.getString(2),
                    language = rs.getString(3), description = rs.getString(4),
                    fileCount = rs.getInt(5), symbolCount = rs.getInt(6),
                    diStyle = rs.getString(7), errorHandling = rs.getString(8),
                    namingConvention = rs.getString(9), loggingFramework = rs.getString(10),
                    testingFramework = rs.getString(11), purpose = rs.getString(12)
                ))
            }
        }
        return results
    }

    /** List modules with pattern metadata, optionally filtered by name. */
    fun listModulesWithPatterns(name: String?): List<ModuleResult> {
        if (name == null) return listModules()
        val sql = """SELECT name, root_path, language, description, file_count, symbol_count,
            di_style, error_handling, naming_convention,
            logging_framework, testing_framework, purpose
            FROM modules WHERE name LIKE ? ORDER BY name"""
        val results = mutableListOf<ModuleResult>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, "$name%")
            val rs = stmt.executeQuery()
            while (rs.next()) {
                results.add(ModuleResult(
                    name = rs.getString(1), rootPath = rs.getString(2),
                    language = rs.getString(3), description = rs.getString(4),
                    fileCount = rs.getInt(5), symbolCount = rs.getInt(6),
                    diStyle = rs.getString(7), errorHandling = rs.getString(8),
                    namingConvention = rs.getString(9), loggingFramework = rs.getString(10),
                    testingFramework = rs.getString(11), purpose = rs.getString(12)
                ))
            }
        }
        return results
    }

    /** Get index status and statistics. */
    fun getIndexStatus(): IndexStatus {
        val conn = db.conn
        val totalFiles = queryInt(conn, "SELECT COUNT(*) FROM files")
        val totalSymbols = queryInt(conn, "SELECT COUNT(*) FROM symbols")
        val totalModules = queryInt(conn, "SELECT COUNT(*) FROM modules")
        val lastIndexed = queryString(conn, "SELECT MAX(last_indexed) FROM files")
        val languages = mutableMapOf<String, Int>()
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT language, COUNT(*) FROM files GROUP BY language")
            while (rs.next()) languages[rs.getString(1)] = rs.getInt(2)
        }
        return IndexStatus(totalFiles, totalSymbols, totalModules, lastIndexed, languages)
    }

    private fun queryInt(conn: java.sql.Connection, sql: String): Int {
        conn.createStatement().use { val rs = it.executeQuery(sql); rs.next(); return rs.getInt(1) }
    }

    private fun queryString(conn: java.sql.Connection, sql: String): String? {
        conn.createStatement().use { val rs = it.executeQuery(sql); rs.next(); return rs.getString(1) }
    }

    private fun sanitizeFtsQuery(query: String): String {
        val cleaned = query.replace(Regex("[^\\w\\s*\"]"), " ").trim()
        return cleaned.ifEmpty { "*" }
    }
}
