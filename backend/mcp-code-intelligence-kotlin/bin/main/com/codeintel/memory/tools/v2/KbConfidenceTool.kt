/** KSA-80: Confidence Scoring for Search Results. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

class KbConfidenceTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "stats") {
            "compute" -> computeConfidence(args)
            "batch" -> batchCompute(args)
            "unreliable" -> getUnreliable(args)
            else -> getStats()
        }
    }

    private fun computeConfidence(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val rs = conn.prepareStatement("SELECT * FROM knowledge_entries WHERE id = ?").use { it.setInt(1, entryId); it.executeQuery() }
        if (!rs.next()) return """{"error":"entry not found"}"""

        val quality = getQualitySignal(entryId)
        val citations = getCitationSignal(entryId)
        val feedback = getFeedbackSignal(rs.getDouble("feedback_score"))
        val freshness = getFreshnessSignal(rs.getString("updated_at"))

        val confidence = (0.3 * quality + 0.25 * citations + 0.25 * feedback + 0.2 * freshness) / 100.0
        val normalized = confidence.coerceIn(0.0, 1.0)
        conn.prepareStatement("UPDATE knowledge_entries SET confidence = ? WHERE id = ?").use { it.setDouble(1, normalized); it.setInt(2, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"confidence":${"%.3f".format(normalized)},"signals":{"quality":$quality,"citations":$citations,"feedback":$feedback,"freshness":$freshness}}"""
    }

    private fun batchCompute(args: JsonObject): String {
        val limit = args.int("limit") ?: 200
        val rs = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE archived_at IS NULL LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        var count = 0
        while (rs.next()) { computeConfidence(buildJsonObject { put("entry_id", rs.getInt(1)) }); count++ }
        return """{"computed":$count}"""
    }

    private fun getUnreliable(args: JsonObject): String {
        val limit = args.int("limit") ?: 20
        val rs = conn.prepareStatement("SELECT id, summary, type, confidence FROM knowledge_entries WHERE confidence < 0.4 AND archived_at IS NULL ORDER BY confidence ASC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}","confidence":${rs.getDouble("confidence")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getStats(): String {
        val avg = conn.prepareStatement("SELECT AVG(confidence) FROM knowledge_entries WHERE archived_at IS NULL").use { val rs = it.executeQuery(); rs.next(); rs.getDouble(1) }
        val low = conn.prepareStatement("SELECT COUNT(*) FROM knowledge_entries WHERE confidence < 0.4 AND archived_at IS NULL").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        val high = conn.prepareStatement("SELECT COUNT(*) FROM knowledge_entries WHERE confidence >= 0.8 AND archived_at IS NULL").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        return """{"avg_confidence":${"%.3f".format(avg)},"low_confidence":$low,"high_confidence":$high}"""
    }

    private fun getQualitySignal(entryId: Int): Int {
        val rs = conn.prepareStatement("SELECT total_score FROM quality_scores WHERE entry_id = ?").use { it.setInt(1, entryId); it.executeQuery() }
        return if (rs.next()) rs.getInt(1) else 50
    }

    private fun getCitationSignal(entryId: Int): Int {
        val cnt = conn.prepareStatement("SELECT COUNT(*) FROM citations WHERE entry_id = ?").use { it.setInt(1, entryId); val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        return when { cnt >= 10 -> 100; cnt >= 5 -> 80; cnt >= 2 -> 60; cnt >= 1 -> 40; else -> 20 }
    }

    private fun getFeedbackSignal(score: Double): Int = when {
        score >= 5 -> 100; score >= 2 -> 80; score >= 0 -> 60; score >= -2 -> 40; else -> 20
    }

    private fun getFreshnessSignal(updatedAt: String?): Int {
        if (updatedAt == null) return 30
        val days = try { ChronoUnit.DAYS.between(Instant.parse(updatedAt), Instant.now()) } catch (_: Exception) { 180L }
        return when { days < 7 -> 100; days < 30 -> 80; days < 90 -> 60; else -> 30 }
    }
}
