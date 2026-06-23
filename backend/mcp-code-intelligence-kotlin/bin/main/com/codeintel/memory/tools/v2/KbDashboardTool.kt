/** KSA-84: KB Health Dashboard & Metrics. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

class KbDashboardTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "full") {
            "metrics" -> getMetrics()
            "recommendations" -> getRecommendations()
            "trends" -> getTrends(args.int("days") ?: 30)
            else -> """{"metrics":${getMetrics()},"recommendations":${getRecommendations()}}"""
        }
    }

    private fun getMetrics(): String {
        val total = queryInt("SELECT COUNT(*) FROM knowledge_entries WHERE archived_at IS NULL")
        val archived = queryInt("SELECT COUNT(*) FROM knowledge_entries WHERE archived_at IS NOT NULL")
        val withOwner = queryInt("SELECT COUNT(*) FROM knowledge_entries WHERE owner IS NOT NULL AND owner != '' AND archived_at IS NULL")
        val reviewed90 = queryInt("SELECT COUNT(*) FROM knowledge_entries WHERE last_reviewed_at > datetime('now', '-90 days') AND archived_at IS NULL")
        val avgQuality = queryDouble("SELECT AVG(total_score) FROM quality_scores")
        val avgConf = queryDouble("SELECT AVG(confidence) FROM knowledge_entries WHERE archived_at IS NULL")
        val ownerRate = if (total > 0) withOwner * 100 / total else 0
        val reviewRate = if (total > 0) reviewed90 * 100 / total else 0
        return """{"total_entries":$total,"archived":$archived,"ownership_rate":$ownerRate,"review_rate_90d":$reviewRate,"avg_quality":${"%.1f".format(avgQuality)},"avg_confidence":${"%.3f".format(avgConf)}}"""
    }

    private fun getRecommendations(): String {
        val recs = mutableListOf<String>()
        val ownerRate = queryInt("SELECT COUNT(*) FROM knowledge_entries WHERE owner IS NOT NULL AND owner != '' AND archived_at IS NULL") * 100 / (queryInt("SELECT COUNT(*) FROM knowledge_entries WHERE archived_at IS NULL").coerceAtLeast(1))
        if (ownerRate < 80) recs.add("""{"priority":"high","action":"Assign owners","detail":"Only ${ownerRate}% have owners"}""")
        val avgQuality = queryDouble("SELECT AVG(total_score) FROM quality_scores")
        if (avgQuality < 60) recs.add("""{"priority":"medium","action":"Improve content quality","detail":"Avg: ${"%.0f".format(avgQuality)}/100"}""")
        if (recs.isEmpty()) recs.add("""{"priority":"low","action":"KB is healthy","detail":"All metrics OK"}""")
        return "[${recs.joinToString(",")}]"
    }

    private fun getTrends(days: Int): String {
        val cutoff = Instant.now().minus(days.toLong(), ChronoUnit.DAYS).toString()
        val newEntries = queryInt("SELECT COUNT(*) FROM knowledge_entries WHERE created_at > '$cutoff'")
        val searches = queryInt("SELECT COUNT(*) FROM search_log WHERE searched_at > '$cutoff'")
        val citations = queryInt("SELECT COUNT(*) FROM citations WHERE cited_at > '$cutoff'")
        return """{"period_days":$days,"new_entries":$newEntries,"searches":$searches,"citations":$citations}"""
    }

    private fun queryInt(sql: String): Int = conn.prepareStatement(sql).use { val rs = it.executeQuery(); if (rs.next()) rs.getInt(1) else 0 }
    private fun queryDouble(sql: String): Double = conn.prepareStatement(sql).use { val rs = it.executeQuery(); if (rs.next()) rs.getDouble(1) else 0.0 }
}
