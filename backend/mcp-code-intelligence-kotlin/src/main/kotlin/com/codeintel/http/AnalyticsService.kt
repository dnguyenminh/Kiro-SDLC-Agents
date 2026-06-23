/** Analytics service — search analytics, popular queries, zero-result gaps. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection

/** Queries search_log and popular_queries tables for viewer display. */
class AnalyticsService(private val conn: Connection) {

    fun getAnalytics(): AnalyticsResponse = runCatching {
        AnalyticsResponse(
            popular_queries = getPopularQueries(),
            zero_results = getZeroResultQueries(),
            search_trend = getSearchTrend()
        )
    }.getOrDefault(AnalyticsResponse(emptyList(), emptyList(), emptyList()))

    private fun getPopularQueries(): List<PopularQuery> {
        return runCatching {
            conn.createStatement().use { stmt ->
                val rs = stmt.executeQuery(
                    "SELECT query, hit_count as count, " +
                    "CAST(hit_count AS REAL) as avg_results " +
                    "FROM popular_queries ORDER BY hit_count DESC LIMIT 15"
                )
                buildList {
                    while (rs.next()) add(PopularQuery(
                        query = rs.getString("query"),
                        count = rs.getInt("count"),
                        avg_results = rs.getInt("avg_results")
                    ))
                }
            }
        }.getOrElse {
            // Fallback: aggregate from search_log directly
            runCatching {
                conn.createStatement().use { stmt ->
                    val rs = stmt.executeQuery(
                        "SELECT query, COUNT(*) as count, " +
                        "AVG(result_count) as avg_results " +
                        "FROM search_log GROUP BY query ORDER BY count DESC LIMIT 15"
                    )
                    buildList {
                        while (rs.next()) add(PopularQuery(
                            query = rs.getString("query"),
                            count = rs.getInt("count"),
                            avg_results = rs.getInt("avg_results")
                        ))
                    }
                }
            }.getOrDefault(emptyList())
        }
    }

    private fun getZeroResultQueries(): List<ZeroResultQuery> = runCatching {
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(
                "SELECT query, COUNT(*) as count FROM search_log " +
                "WHERE result_count = 0 GROUP BY query ORDER BY count DESC LIMIT 15"
            )
            buildList {
                while (rs.next()) add(ZeroResultQuery(
                    query = rs.getString("query"),
                    count = rs.getInt("count")
                ))
            }
        }
    }.getOrDefault(emptyList())

    private fun getSearchTrend(): List<TrendPoint> = runCatching {
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(
                "SELECT DATE(searched_at) as day, COUNT(*) as cnt FROM search_log " +
                "WHERE searched_at >= datetime('now', '-30 days') " +
                "GROUP BY DATE(searched_at) ORDER BY day"
            )
            buildList { while (rs.next()) add(TrendPoint(rs.getInt("cnt"))) }
        }
    }.getOrDefault(emptyList())
}

@Serializable
data class AnalyticsResponse(
    val popular_queries: List<PopularQuery>,
    val zero_results: List<ZeroResultQuery>,
    val search_trend: List<TrendPoint>
)

@Serializable
data class PopularQuery(
    val query: String,
    val count: Int,
    val avg_results: Int = 0
)

@Serializable
data class ZeroResultQuery(
    val query: String,
    val count: Int
)
