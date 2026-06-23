/**
 * KSA-162: SQLite store for entry point results.
 */
package com.codeintel.analyzers.entrypoints

import java.sql.Connection

class EntryPointStore(private val conn: Connection) {

    init { ensureTable() }

    fun upsertBatch(entries: List<EntryPoint>) {
        val sql = """
            INSERT OR REPLACE INTO entry_points
              (symbol_id, entry_type, framework, http_method, route_path,
               full_route, middleware, has_auth, controller, event_name, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()
        conn.autoCommit = false
        try {
            conn.prepareStatement(sql).use { stmt ->
                for (ep in entries) {
                    stmt.setInt(1, ep.symbolId)
                    stmt.setString(2, ep.entryType.name)
                    stmt.setString(3, ep.framework)
                    stmt.setString(4, ep.httpMethod)
                    stmt.setString(5, ep.routePath)
                    stmt.setString(6, ep.fullRoute)
                    stmt.setString(7, ep.middleware.joinToString(","))
                    stmt.setInt(8, if (ep.hasAuth) 1 else 0)
                    stmt.setString(9, ep.controller)
                    stmt.setString(10, ep.eventName)
                    stmt.setString(11, ep.confidence.name)
                    stmt.addBatch()
                }
                stmt.executeBatch()
            }
            conn.commit()
        } finally { conn.autoCommit = true }
    }

    fun query(filters: EntryPointFilters): EntryPointQueryResult {
        val (where, params) = buildWhere(filters)
        val countSql = "SELECT COUNT(*) FROM entry_points ep " +
            "JOIN symbols s ON s.id = ep.symbol_id " +
            "JOIN files f ON f.id = s.file_id WHERE $where"
        val total = conn.prepareStatement(countSql).use { stmt ->
            params.forEachIndexed { i, v -> stmt.setObject(i + 1, v) }
            val rs = stmt.executeQuery()
            if (rs.next()) rs.getInt(1) else 0
        }
        val dataSql = """
            SELECT ep.*, s.name as symbol_name, f.relative_path as file_path, s.start_line
            FROM entry_points ep
            JOIN symbols s ON s.id = ep.symbol_id
            JOIN files f ON f.id = s.file_id
            WHERE $where ORDER BY ep.entry_type, s.name LIMIT ?
        """.trimIndent()
        val results = conn.prepareStatement(dataSql).use { stmt ->
            params.forEachIndexed { i, v -> stmt.setObject(i + 1, v) }
            stmt.setInt(params.size + 1, filters.limit)
            val rs = stmt.executeQuery()
            val list = mutableListOf<EntryPoint>()
            while (rs.next()) list.add(mapRow(rs))
            list
        }
        return EntryPointQueryResult(results, total, computeSummary(results))
    }

    private fun buildWhere(f: EntryPointFilters): Pair<String, List<Any>> {
        val clauses = mutableListOf("1=1")
        val params = mutableListOf<Any>()
        f.entryType?.let { clauses.add("ep.entry_type = ?"); params.add(it.name) }
        f.framework?.let { clauses.add("ep.framework = ?"); params.add(it) }
        f.httpMethod?.let { clauses.add("ep.http_method = ?"); params.add(it.uppercase()) }
        f.routePattern?.let { clauses.add("ep.full_route LIKE ?"); params.add("%$it%") }
        f.hasAuth?.let { clauses.add("ep.has_auth = ?"); params.add(if (it) 1 else 0) }
        f.filePath?.let { clauses.add("f.relative_path LIKE ?"); params.add("%$it%") }
        return clauses.joinToString(" AND ") to params
    }

    private fun computeSummary(results: List<EntryPoint>): EntryPointSummary {
        val byType = results.groupBy { it.entryType.name }.mapValues { it.value.size }
        val byFramework = results.filter { it.framework != null }
            .groupBy { it.framework!! }.mapValues { it.value.size }
        val withAuth = results.count { it.hasAuth }
        return EntryPointSummary(byType, byFramework, AuthCoverage(withAuth, results.size - withAuth))
    }

    private fun mapRow(rs: java.sql.ResultSet): EntryPoint = EntryPoint(
        symbolId = rs.getInt("symbol_id"),
        symbolName = rs.getString("symbol_name"),
        filePath = rs.getString("file_path"),
        startLine = rs.getInt("start_line"),
        entryType = EntryType.valueOf(rs.getString("entry_type")),
        framework = rs.getString("framework"),
        httpMethod = rs.getString("http_method"),
        routePath = rs.getString("route_path"),
        fullRoute = rs.getString("full_route"),
        middleware = rs.getString("middleware")?.split(",")?.filter { it.isNotEmpty() } ?: emptyList(),
        hasAuth = rs.getInt("has_auth") == 1,
        controller = rs.getString("controller"),
        eventName = rs.getString("event_name"),
        confidence = try { Confidence.valueOf(rs.getString("confidence")) } catch (_: Exception) { Confidence.Medium },
    )

    private fun ensureTable() {
        conn.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS entry_points (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  symbol_id INTEGER NOT NULL,
                  entry_type TEXT NOT NULL,
                  framework TEXT,
                  http_method TEXT,
                  route_path TEXT,
                  full_route TEXT,
                  middleware TEXT,
                  has_auth INTEGER NOT NULL DEFAULT 0,
                  controller TEXT,
                  event_name TEXT,
                  confidence TEXT NOT NULL DEFAULT 'Medium',
                  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
                  UNIQUE(symbol_id)
                )
            """.trimIndent())
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_ep_type ON entry_points(entry_type)")
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_ep_route ON entry_points(full_route)")
        }
    }
}
