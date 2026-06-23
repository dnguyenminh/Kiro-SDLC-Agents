/** KSA-78: Search Analytics & Query Optimization. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection

class KbAnalyticsTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        val limit = args.int("limit") ?: 10
        return when (args.str("action") ?: "summary") {
            "popular" -> getPopularQueries(limit)
            "gaps" -> getContentGaps()
            "zero_results" -> getZeroResultQueries(limit)
            else -> getSummary()
        }
    }

    /** Log a search query for analytics tracking. */
    fun logSearch(query: String, resultCount: Int) {
        try {
            conn.prepareStatement("INSERT INTO search_log (query, result_count) VALUES (?, ?)").use { it.setString(1, query); it.setInt(2, resultCount); it.executeUpdate() }
            conn.prepareStatement("INSERT INTO popular_queries (query, hit_count, avg_results) VALUES (?, 1, ?) ON CONFLICT(query) DO UPDATE SET hit_count = hit_count + 1, avg_results = (avg_results * (hit_count - 1) + ?) / hit_count, last_searched = datetime('now')").use { it.setString(1, query); it.setInt(2, resultCount); it.setInt(3, resultCount); it.executeUpdate() }
        } catch (_: Exception) { /* analytics should not break main flow */ }
    }

    private fun getPopularQueries(limit: Int): String {
        val rs = conn.prepareStatement("SELECT query, hit_count, avg_results FROM popular_queries ORDER BY hit_count DESC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"query":"${rs.getString("query")?.replace("\"", "'")}","hit_count":${rs.getInt("hit_count")},"avg_results":${rs.getDouble("avg_results")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getZeroResultQueries(limit: Int): String {
        val rs = conn.prepareStatement("SELECT query, hit_count FROM popular_queries WHERE avg_results = 0 ORDER BY hit_count DESC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"query":"${rs.getString("query")?.replace("\"", "'")}","hit_count":${rs.getInt("hit_count")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getContentGaps(): String {
        val zero = conn.prepareStatement("SELECT COUNT(*) FROM popular_queries WHERE avg_results = 0").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        val total = conn.prepareStatement("SELECT COUNT(*) FROM popular_queries").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        val rate = if (total > 0) "%.1f".format(zero.toDouble() / total * 100) + "%" else "0%"
        return """{"total_queries":$total,"zero_result_queries":$zero,"gap_rate":"$rate"}"""
    }

    private fun getSummary(): String {
        val total = conn.prepareStatement("SELECT COUNT(*) FROM search_log").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        val unique = conn.prepareStatement("SELECT COUNT(*) FROM popular_queries").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        return """{"total_searches":$total,"unique_queries":$unique}"""
    }
}
