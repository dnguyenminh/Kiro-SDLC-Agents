/**
 * KSA-161: SQLite CRUD for complexity results.
 */
package com.codeintel.analyzers.complexity

import java.sql.Connection

class ComplexityStore(private val conn: Connection) {

    init { ensureTable() }

    fun upsert(result: ComplexityResult) {
        val sql = """
            INSERT OR REPLACE INTO complexity
              (symbol_id, cyclomatic_complexity, branches, loops, logical_ops,
               nesting_depth, early_returns, exception_handlers, grade, computed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """.trimIndent()
        conn.prepareStatement(sql).use { stmt ->
            stmt.setInt(1, result.symbolId)
            stmt.setInt(2, result.cyclomaticComplexity)
            stmt.setInt(3, result.branches)
            stmt.setInt(4, result.loops)
            stmt.setInt(5, result.logicalOps)
            stmt.setInt(6, result.nestingDepth)
            stmt.setInt(7, result.earlyReturns)
            stmt.setInt(8, result.exceptionHandlers)
            stmt.setString(9, result.grade.name)
            stmt.executeUpdate()
        }
    }

    fun upsertBatch(results: List<ComplexityResult>) {
        conn.autoCommit = false
        try {
            results.forEach { upsert(it) }
            conn.commit()
        } finally {
            conn.autoCommit = true
        }
    }

    fun getBySymbol(symbolId: Int): ComplexityResult? {
        val sql = """
            SELECT c.*, s.name as symbol_name, f.relative_path as file_path,
                   s.start_line, s.end_line
            FROM complexity c
            JOIN symbols s ON s.id = c.symbol_id
            JOIN files f ON f.id = s.file_id
            WHERE c.symbol_id = ?
        """.trimIndent()
        conn.prepareStatement(sql).use { stmt ->
            stmt.setInt(1, symbolId)
            val rs = stmt.executeQuery()
            if (!rs.next()) return null
            return mapRow(rs)
        }
    }

    fun query(filters: ComplexityFilters): ComplexityQueryResult {
        val where = buildWhere(filters)
        val countSql = "SELECT COUNT(*) FROM complexity c " +
            "JOIN symbols s ON s.id = c.symbol_id " +
            "JOIN files f ON f.id = s.file_id WHERE ${where.first}"
        val total = conn.prepareStatement(countSql).use { stmt ->
            where.second.forEachIndexed { i, v -> stmt.setObject(i + 1, v) }
            val rs = stmt.executeQuery()
            if (rs.next()) rs.getInt(1) else 0
        }

        val orderBy = when (filters.sortBy) {
            SortBy.NAME -> "s.name ASC"
            SortBy.FILE -> "f.relative_path ASC, s.start_line ASC"
            else -> "c.cyclomatic_complexity DESC"
        }
        val dataSql = """
            SELECT c.*, s.name as symbol_name, f.relative_path as file_path,
                   s.start_line, s.end_line
            FROM complexity c
            JOIN symbols s ON s.id = c.symbol_id
            JOIN files f ON f.id = s.file_id
            WHERE ${where.first}
            ORDER BY $orderBy LIMIT ?
        """.trimIndent()
        val results = conn.prepareStatement(dataSql).use { stmt ->
            where.second.forEachIndexed { i, v -> stmt.setObject(i + 1, v) }
            stmt.setInt(where.second.size + 1, filters.limit)
            val rs = stmt.executeQuery()
            val list = mutableListOf<ComplexityResult>()
            while (rs.next()) list.add(mapRow(rs))
            list
        }

        val summary = computeSummary(filters.module)
        return ComplexityQueryResult(results, total, summary)
    }

    private fun buildWhere(f: ComplexityFilters): Pair<String, List<Any>> {
        val clauses = mutableListOf("1=1")
        val params = mutableListOf<Any>()
        f.filePath?.let { clauses.add("f.relative_path LIKE ?"); params.add("%$it%") }
        f.symbolName?.let { clauses.add("s.name LIKE ?"); params.add("%$it%") }
        f.minComplexity?.let { clauses.add("c.cyclomatic_complexity >= ?"); params.add(it) }
        f.gradeFilter?.let { grades ->
            val ph = grades.joinToString(",") { "?" }
            clauses.add("c.grade IN ($ph)")
            params.addAll(grades.map { it.name })
        }
        f.module?.let { clauses.add("f.module = ?"); params.add(it) }
        return clauses.joinToString(" AND ") to params
    }

    private fun computeSummary(module: String?): ComplexitySummary {
        val distSql = buildString {
            append("SELECT c.grade, COUNT(*) as cnt FROM complexity c ")
            append("JOIN symbols s ON s.id = c.symbol_id ")
            append("JOIN files f ON f.id = s.file_id ")
            if (module != null) append("WHERE f.module = ? ")
            append("GROUP BY c.grade")
        }
        val dist = mutableMapOf<Grade, Int>()
        Grade.entries.forEach { dist[it] = 0 }
        conn.prepareStatement(distSql).use { stmt ->
            module?.let { stmt.setString(1, it) }
            val rs = stmt.executeQuery()
            while (rs.next()) {
                val g = try { Grade.valueOf(rs.getString("grade")) } catch (_: Exception) { null }
                g?.let { dist[it] = rs.getInt("cnt") }
            }
        }
        val avgSql = "SELECT AVG(cyclomatic_complexity) FROM complexity"
        val avg = conn.prepareStatement(avgSql).use { stmt ->
            val rs = stmt.executeQuery()
            if (rs.next()) rs.getDouble(1) else 0.0
        }
        return ComplexitySummary(avg, dist)
    }

    private fun mapRow(rs: java.sql.ResultSet): ComplexityResult =
        ComplexityResult(
            symbolId = rs.getInt("symbol_id"),
            symbolName = rs.getString("symbol_name"),
            filePath = rs.getString("file_path"),
            startLine = rs.getInt("start_line"),
            endLine = rs.getInt("end_line"),
            grade = try { Grade.valueOf(rs.getString("grade")) } catch (_: Exception) { Grade.A },
            cyclomaticComplexity = rs.getInt("cyclomatic_complexity"),
            branches = rs.getInt("branches"),
            loops = rs.getInt("loops"),
            logicalOps = rs.getInt("logical_ops"),
            exceptionHandlers = rs.getInt("exception_handlers"),
            nestingDepth = rs.getInt("nesting_depth"),
            earlyReturns = rs.getInt("early_returns"),
        )

    private fun ensureTable() {
        conn.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS complexity (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol_id INTEGER NOT NULL,
                  cyclomatic_complexity INTEGER NOT NULL DEFAULT 1,
                  branches INTEGER NOT NULL DEFAULT 0,
                  loops INTEGER NOT NULL DEFAULT 0,
                  logical_ops INTEGER NOT NULL DEFAULT 0,
                  nesting_depth INTEGER NOT NULL DEFAULT 0,
                  early_returns INTEGER NOT NULL DEFAULT 0,
                  exception_handlers INTEGER NOT NULL DEFAULT 0,
                  grade TEXT NOT NULL DEFAULT 'A',
                  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
                  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
                  UNIQUE(symbol_id)
                )
            """.trimIndent())
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_complexity_grade ON complexity(grade)")
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_complexity_cc ON complexity(cyclomatic_complexity DESC)")
        }
    }
}
