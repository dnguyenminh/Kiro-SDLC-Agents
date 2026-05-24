/** Health dashboard service — computes KB health metrics and recommendations. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection

/**
 * Computes KB health score, metrics, recommendations, and trends.
 * Uses unified formula consistent across NodeJS/Python/Kotlin:
 *   total_entries = COUNT(*) FROM knowledge_entries (no filters)
 *   stale_count = updated_at < -90 days
 *   unowned_count = source IS NULL OR source = ''
 *   health_score = qualityAvg * 0.4 + staleRatio * 0.3 + ownedRatio * 0.3
 */
class HealthDashboardService(private val conn: Connection) {

    fun getDashboard(): DashboardResponse {
        val metrics = computeMetrics()
        val healthScore = computeHealthScore(metrics)
        val recommendations = generateRecommendations(metrics)
        val trends = getTrends(7)
        return DashboardResponse(
            health_score = healthScore,
            total_entries = metrics.totalEntries,
            quality_avg = metrics.qualityAvg,
            stale_count = metrics.staleCount,
            unowned_count = metrics.unownedCount,
            recommendations = recommendations,
            trends = trends,
            metrics = metrics
        )
    }

    fun getMetrics(): DashboardMetrics = computeMetrics()

    private fun computeMetrics(): DashboardMetrics {
        val total = countEntries()
        val qualityAvg = queryQualityAvg()
        val stale = countStale()
        val unowned = countUnowned()
        val staleRatio = if (total > 0) (1.0 - stale.toDouble() / total) * 100 else 100.0
        val ownedRatio = if (total > 0) (1.0 - unowned.toDouble() / total) * 100 else 100.0
        return DashboardMetrics(
            totalEntries = total,
            qualityAvg = qualityAvg,
            staleCount = stale,
            unownedCount = unowned,
            freshPct = staleRatio.round1(),
            coverageScore = ownedRatio.round1(),
            engagementScore = 0.0
        )
    }

    private fun computeHealthScore(m: DashboardMetrics): Double {
        if (m.totalEntries == 0) return 0.0
        val qualityScore = m.qualityAvg.coerceIn(0.0, 100.0)
        val staleRatio = m.freshPct
        val ownedRatio = m.coverageScore
        val total = qualityScore * 0.4 + staleRatio * 0.3 + ownedRatio * 0.3
        return total.coerceIn(0.0, 100.0).round1()
    }

    private fun generateRecommendations(m: DashboardMetrics): List<DashboardRec> {
        val recs = mutableListOf<DashboardRec>()
        if (m.qualityAvg < 60) {
            recs.add(DashboardRec("Improve low-quality entries", "high"))
        }
        if (m.totalEntries > 0 && m.staleCount.toDouble() / m.totalEntries > 0.3) {
            recs.add(DashboardRec("Review ${m.staleCount} stale entries", "high"))
        }
        if (m.totalEntries > 0 && m.unownedCount.toDouble() / m.totalEntries > 0.5) {
            recs.add(DashboardRec("Assign owners to ${m.unownedCount} entries", "medium"))
        }
        return recs
    }

    private fun getTrends(days: Int): DashboardTrends {
        return DashboardTrends(
            search_volume = searchTrend(days),
            ingest_volume = ingestTrend(days)
        )
    }

    // No filters — count ALL entries
    private fun countEntries(): Int = scalarInt(
        "SELECT COUNT(*) FROM knowledge_entries"
    )

    // Stale: not updated in 90+ days
    private fun countStale(): Int = scalarInt(
        "SELECT COUNT(*) FROM knowledge_entries WHERE updated_at < datetime('now', '-90 days')"
    )

    // Unowned: no source assigned
    private fun countUnowned(): Int = scalarInt(
        "SELECT COUNT(*) FROM knowledge_entries WHERE source IS NULL OR source = ''"
    )

    private fun queryQualityAvg(): Double = runCatching {
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT AVG(confidence) FROM knowledge_entries")
            if (rs.next()) rs.getDouble(1).round1() else 0.0
        }
    }.getOrDefault(0.0)

    private fun searchTrend(days: Int): List<TrendPoint> = runCatching {
        conn.prepareStatement(
            "SELECT DATE(searched_at) as day, COUNT(*) as cnt FROM search_log " +
            "WHERE searched_at >= datetime('now', ?) GROUP BY DATE(searched_at) ORDER BY day"
        ).use { stmt ->
            stmt.setString(1, "-$days days")
            val rs = stmt.executeQuery()
            buildList { while (rs.next()) add(TrendPoint(rs.getInt("cnt"))) }
        }
    }.getOrDefault(emptyList())

    private fun ingestTrend(days: Int): List<TrendPoint> = runCatching {
        conn.prepareStatement(
            "SELECT DATE(created_at) as day, COUNT(*) as cnt FROM memory_audit " +
            "WHERE operation = 'INGEST' AND created_at >= datetime('now', ?) " +
            "GROUP BY DATE(created_at) ORDER BY day"
        ).use { stmt ->
            stmt.setString(1, "-$days days")
            val rs = stmt.executeQuery()
            buildList { while (rs.next()) add(TrendPoint(rs.getInt("cnt"))) }
        }
    }.getOrDefault(emptyList())

    private fun scalarInt(sql: String): Int = runCatching {
        conn.createStatement().use {
            it.executeQuery(sql).let { rs -> if (rs.next()) rs.getInt(1) else 0 }
        }
    }.getOrDefault(0)

    private fun Double.round1() = (this * 10).toLong() / 10.0
}

@Serializable
data class DashboardResponse(
    val health_score: Double,
    val total_entries: Int,
    val quality_avg: Double,
    val stale_count: Int,
    val unowned_count: Int,
    val recommendations: List<DashboardRec>,
    val trends: DashboardTrends,
    val metrics: DashboardMetrics
)

@Serializable
data class DashboardRec(val message: String, val priority: String)

@Serializable
data class DashboardTrends(
    val search_volume: List<TrendPoint>,
    val ingest_volume: List<TrendPoint>
)

@Serializable
data class TrendPoint(val count: Int)

@Serializable
data class DashboardMetrics(
    val totalEntries: Int,
    val qualityAvg: Double,
    val staleCount: Int,
    val unownedCount: Int,
    val freshPct: Double,
    val coverageScore: Double,
    val engagementScore: Double
)
