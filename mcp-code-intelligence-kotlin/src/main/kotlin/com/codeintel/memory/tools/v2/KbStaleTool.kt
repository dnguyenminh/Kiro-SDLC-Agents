/** KSA-70: Staleness Detection & Auto-Archive + Review management. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

private const val STALE_DAYS = 180L

class KbStaleTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        val action = args.str("action") ?: "detect"
        val threshold = args.double("threshold") ?: 0.8
        return when (action) {
            "unarchive" -> unarchive(args.int("entry_id") ?: return "Error: entry_id required")
            "archive" -> autoArchive(threshold, args.bool("dry_run"))
            else -> detectStale(threshold)
        }
    }

    fun executeDueReviews(args: JsonObject): String {
        val days = args.int("days") ?: 90
        val limit = args.int("limit") ?: 20
        val cutoff = Instant.now().minus(days.toLong(), ChronoUnit.DAYS).toString()
        val rs = conn.prepareStatement(
            "SELECT id, summary, type, owner, last_reviewed_at FROM knowledge_entries WHERE archived_at IS NULL AND (last_reviewed_at IS NULL OR last_reviewed_at < ?) ORDER BY last_reviewed_at ASC LIMIT ?"
        ).use { it.setString(1, cutoff); it.setInt(2, limit); it.executeQuery() }
        val lines = mutableListOf<String>()
        while (rs.next()) {
            lines.add("#${rs.getInt("id")} [${rs.getString("type")}] ${rs.getString("summary")?.take(60)}")
            lines.add("  Owner: ${rs.getString("owner") ?: "unassigned"} | Last reviewed: ${rs.getString("last_reviewed_at") ?: "never"}")
        }
        return if (lines.isEmpty()) "No entries due for review." else "Entries due for review:\n${lines.joinToString("\n")}"
    }

    fun executeReview(args: JsonObject): String {
        val action = args.str("action") ?: "mark_reviewed"
        val entryId = args.int("entry_id") ?: return "Error: entry_id required"
        return when (action) {
            "mark_reviewed" -> markReviewed(entryId)
            "assign_owner" -> assignField(entryId, "owner", args.str("owner") ?: "")
            "assign_reviewer" -> assignField(entryId, "reviewer", args.str("reviewer") ?: "")
            "set_status" -> setStatus(entryId, args.str("status") ?: "pending")
            else -> """{"error":"Unknown action: $action"}"""
        }
    }

    private fun detectStale(threshold: Double): String {
        recomputeStaleness()
        val rs = conn.prepareStatement(
            "SELECT id, summary, type, staleness_score FROM knowledge_entries WHERE staleness_score >= ? AND archived_at IS NULL ORDER BY staleness_score DESC LIMIT 50"
        ).use { it.setDouble(1, threshold); it.executeQuery() }
        val entries = mutableListOf<String>()
        while (rs.next()) entries.add("""{"id":${rs.getInt("id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}","staleness":${rs.getDouble("staleness_score")}}""")
        return """{"stale_count":${entries.size},"entries":[${entries.joinToString(",")}]}"""
    }

    private fun autoArchive(threshold: Double, dryRun: Boolean): String {
        recomputeStaleness()
        val rs = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE staleness_score >= ? AND archived_at IS NULL").use { it.setDouble(1, threshold); it.executeQuery() }
        val ids = mutableListOf<Int>()
        while (rs.next()) ids.add(rs.getInt(1))
        if (!dryRun) ids.forEach { archiveEntry(it) }
        return """{"archived_count":${ids.size},"dry_run":$dryRun}"""
    }

    private fun unarchive(entryId: Int): String {
        conn.prepareStatement("UPDATE knowledge_entries SET archived_at = NULL, staleness_score = 0.0 WHERE id = ?").use { it.setInt(1, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"status":"unarchived"}"""
    }

    private fun markReviewed(entryId: Int): String {
        val now = Instant.now().toString()
        conn.prepareStatement("UPDATE knowledge_entries SET last_reviewed_at = ?, staleness_score = 0.0 WHERE id = ?").use { it.setString(1, now); it.setInt(2, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"reviewed_at":"$now"}"""
    }

    private fun assignField(entryId: Int, field: String, value: String): String {
        conn.prepareStatement("UPDATE knowledge_entries SET $field = ? WHERE id = ?").use { it.setString(1, value); it.setInt(2, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"$field":"$value"}"""
    }

    private fun setStatus(entryId: Int, status: String): String {
        conn.prepareStatement("UPDATE knowledge_entries SET review_status = ? WHERE id = ?").use { it.setString(1, status); it.setInt(2, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"review_status":"$status"}"""
    }

    private fun recomputeStaleness() {
        val now = Instant.now()
        val rs = conn.prepareStatement("SELECT id, last_accessed_at, updated_at, last_reviewed_at FROM knowledge_entries WHERE archived_at IS NULL").executeQuery()
        val updates = mutableListOf<Pair<Int, Double>>()
        while (rs.next()) {
            val score = computeScore(rs.getString("last_accessed_at"), rs.getString("updated_at"), rs.getString("last_reviewed_at"), now)
            updates.add(rs.getInt("id") to score)
        }
        conn.prepareStatement("UPDATE knowledge_entries SET staleness_score = ? WHERE id = ?").use { ps ->
            for ((id, score) in updates) { ps.setDouble(1, score); ps.setInt(2, id); ps.addBatch() }
            ps.executeBatch()
        }
    }

    private fun computeScore(access: String?, update: String?, review: String?, now: Instant): Double {
        fun daysSince(dt: String?): Double {
            if (dt == null) return STALE_DAYS.toDouble()
            return try { ChronoUnit.DAYS.between(Instant.parse(dt), now).toDouble().coerceAtMost(STALE_DAYS.toDouble()) } catch (_: Exception) { STALE_DAYS.toDouble() }
        }
        val a = daysSince(access) / STALE_DAYS
        val u = daysSince(update) / STALE_DAYS
        val r = daysSince(review) / STALE_DAYS
        return (0.4 * a + 0.3 * u + 0.3 * r).coerceAtMost(1.0)
    }

    private fun archiveEntry(entryId: Int) {
        val now = Instant.now().toString()
        conn.prepareStatement("UPDATE knowledge_entries SET archived_at = ? WHERE id = ?").use { it.setString(1, now); it.setInt(2, entryId); it.executeUpdate() }
        conn.prepareStatement("INSERT INTO archive_log (entry_id, reason, auto_archived) VALUES (?, 'auto:staleness', 1)").use { it.setInt(1, entryId); it.executeUpdate() }
    }
}
