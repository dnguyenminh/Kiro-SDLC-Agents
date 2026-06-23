/** Quality scoring service — stats and low-quality entries for KB viewer. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection

/** Queries quality_scores table for viewer display. */
class QualityService(private val conn: Connection) {

    fun getStats(): QualityStatsResponse = runCatching {
        val avg = queryAvg()
        val scored = scalarInt("SELECT COUNT(*) FROM quality_scores")
        val high = scalarInt("SELECT COUNT(*) FROM quality_scores WHERE total_score >= 70")
        val low = scalarInt("SELECT COUNT(*) FROM quality_scores WHERE total_score < 40")
        val distribution = queryDistribution()
        QualityStatsResponse(
            average_score = avg,
            scored_count = scored,
            high_count = high,
            low_count = low,
            distribution = distribution
        )
    }.getOrDefault(QualityStatsResponse(0.0, 0, 0, 0, emptyMap()))

    fun getLowQuality(threshold: Int, limit: Int): List<LowQualityEntry> = runCatching {
        conn.prepareStatement(
            "SELECT e.id, e.type, e.summary, qs.total_score as score " +
            "FROM quality_scores qs JOIN knowledge_entries e ON qs.entry_id = e.id " +
            "WHERE qs.total_score < ? ORDER BY qs.total_score ASC LIMIT ?"
        ).use { stmt ->
            stmt.setInt(1, threshold)
            stmt.setInt(2, limit)
            val rs = stmt.executeQuery()
            buildList {
                while (rs.next()) add(LowQualityEntry(
                    id = rs.getLong("id"),
                    type = rs.getString("type") ?: "",
                    summary = rs.getString("summary") ?: "",
                    quality_score = rs.getInt("score")
                ))
            }
        }
    }.getOrDefault(emptyList())

    private fun queryAvg(): Double {
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT AVG(total_score) FROM quality_scores")
            return if (rs.next()) (rs.getDouble(1) * 10).toLong() / 10.0 else 0.0
        }
    }

    private fun queryDistribution(): Map<String, Int> {
        val buckets = mutableMapOf<String, Int>()
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(
                "SELECT (CAST(total_score / 10 AS INT) * 10) as bucket, COUNT(*) as cnt " +
                "FROM quality_scores GROUP BY bucket ORDER BY bucket"
            )
            while (rs.next()) {
                buckets[rs.getInt("bucket").toString()] = rs.getInt("cnt")
            }
        }
        return buckets
    }

    private fun scalarInt(sql: String): Int {
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(sql)
            return if (rs.next()) rs.getInt(1) else 0
        }
    }
}

@Serializable
data class QualityStatsResponse(
    val average_score: Double,
    val scored_count: Int,
    val high_count: Int,
    val low_count: Int,
    val distribution: Map<String, Int>
)

@Serializable
data class LowQualityEntry(
    val id: Long,
    val type: String,
    val summary: String,
    val quality_score: Int
)
