/** Recommendation engine — generates prioritized KB improvement suggestions. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

class RecommendationEngine(private val conn: Connection) {

    fun getRecommendations(limit: Int = 10): RecommendationResult {
        val recs = mutableListOf<Recommendation>()
        recs.addAll(findStaleEntries())
        recs.addAll(findUntaggedEntries())
        recs.addAll(findLowQuality())
        recs.addAll(findOrphanEntries())
        recs.sortBy { severityOrder(it.severity) }
        return RecommendationResult(recs.take(limit), recs.size)
    }

    private fun findStaleEntries(): List<Recommendation> {
        val threshold = Instant.now().minus(90, ChronoUnit.DAYS).toString()
        return runCatching {
            val stmt = conn.prepareStatement(
                "SELECT id, summary, type, updated_at FROM knowledge_entries " +
                "WHERE updated_at < ? ORDER BY updated_at ASC LIMIT 20"
            )
            stmt.setString(1, threshold)
            val rs = stmt.executeQuery()
            buildList {
                while (rs.next()) add(buildStaleRec(rs.getLong("id"), rs.getString("summary"), rs.getString("type")))
            }
        }.getOrDefault(emptyList())
    }

    private fun findUntaggedEntries(): List<Recommendation> {
        return runCatching {
            val rs = conn.createStatement().executeQuery(
                "SELECT id, summary, type FROM knowledge_entries " +
                "WHERE (tags IS NULL OR tags = '') ORDER BY created_at DESC LIMIT 15"
            )
            buildList {
                while (rs.next()) add(buildUntagRec(rs.getLong("id"), rs.getString("summary"), rs.getString("type")))
            }
        }.getOrDefault(emptyList())
    }

    private fun findLowQuality(): List<Recommendation> {
        return runCatching {
            val rs = conn.createStatement().executeQuery(
                "SELECT e.id, e.summary, e.type, qs.total_score as quality_score " +
                "FROM quality_scores qs JOIN knowledge_entries e ON qs.entry_id = e.id " +
                "WHERE qs.total_score < 40 ORDER BY qs.total_score ASC LIMIT 10"
            )
            buildList {
                while (rs.next()) add(buildQualityRec(
                    rs.getLong("id"), rs.getString("summary"), rs.getString("type"), rs.getInt("quality_score")
                ))
            }
        }.getOrDefault(emptyList())
    }

    private fun findOrphanEntries(): List<Recommendation> {
        return runCatching {
            val rs = conn.createStatement().executeQuery(
                "SELECT e.id, e.summary, e.type FROM knowledge_entries e " +
                "WHERE e.id NOT IN (" +
                "  SELECT source_id FROM knowledge_graph_edges " +
                "  UNION SELECT target_id FROM knowledge_graph_edges" +
                ") ORDER BY e.created_at DESC LIMIT 10"
            )
            buildList {
                while (rs.next()) add(buildOrphanRec(rs.getLong("id"), rs.getString("summary"), rs.getString("type")))
            }
        }.getOrDefault(emptyList())
    }
}

private fun buildStaleRec(id: Long, summary: String?, type: String?): Recommendation = Recommendation(
    id = "rec-stale-$id", type = "stale", severity = "high",
    title = "Entry #$id chưa review > 90 ngày",
    description = "[${type ?: ""}] ${(summary ?: "").take(80)}",
    entryId = id,
    action = RecAction("Mark Reviewed", "api/kb/entries/$id/review", "POST", false),
)

private fun buildUntagRec(id: Long, summary: String?, type: String?): Recommendation = Recommendation(
    id = "rec-untag-$id", type = "untagged", severity = "medium",
    title = "Entry #$id chưa có tags",
    description = "[${type ?: ""}] ${(summary ?: "").take(80)}",
    entryId = id,
    action = RecAction("Auto-Tag", "api/kb/entries/$id/auto-tag", "POST", false),
)

private fun buildQualityRec(id: Long, summary: String?, type: String?, score: Int): Recommendation = Recommendation(
    id = "rec-quality-$id", type = "low_quality", severity = "medium",
    title = "Entry #$id quality score thấp ($score)",
    description = "[${type ?: ""}] ${(summary ?: "").take(80)}",
    entryId = id, action = null,
)

private fun buildOrphanRec(id: Long, summary: String?, type: String?): Recommendation = Recommendation(
    id = "rec-orphan-$id", type = "orphan", severity = "low",
    title = "Entry #$id không có relationships",
    description = "[${type ?: ""}] ${(summary ?: "").take(80)}",
    entryId = id,
    action = RecAction("Find Related", "api/kb/entries/$id/find-related", "POST", false),
)

private fun severityOrder(severity: String): Int = when (severity) {
    "high" -> 0; "medium" -> 1; "low" -> 2; else -> 3
}

@Serializable
data class Recommendation(
    val id: String,
    val type: String,
    val severity: String,
    val title: String,
    val description: String,
    val entryId: Long,
    val action: RecAction?,
)

@Serializable
data class RecAction(
    val label: String,
    val endpoint: String,
    val method: String,
    val confirm: Boolean = false,
)

@Serializable
data class RecommendationResult(
    val recommendations: List<Recommendation>,
    val total: Int,
)
