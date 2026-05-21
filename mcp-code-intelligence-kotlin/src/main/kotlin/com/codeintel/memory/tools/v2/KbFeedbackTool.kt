/** KSA-81: Feedback Loop (Thumbs Up/Down). */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection

class KbFeedbackTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "summary") {
            "submit" -> submitFeedback(args)
            "low_rated" -> getLowRated(args.int("limit") ?: 10)
            "top_rated" -> getTopRated(args.int("limit") ?: 10)
            else -> getSummary(args)
        }
    }

    private fun submitFeedback(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val rating = args.int("rating") ?: return """{"error":"rating required"}"""
        if (rating != 1 && rating != -1) return """{"error":"rating must be 1 or -1"}"""
        val comment = args.str("comment")
        conn.prepareStatement("INSERT INTO entry_feedback (entry_id, rating, comment) VALUES (?, ?, ?)").use { it.setInt(1, entryId); it.setInt(2, rating); it.setString(3, comment); it.executeUpdate() }
        updateFeedbackScore(entryId)
        return """{"entry_id":$entryId,"rating":$rating,"status":"recorded"}"""
    }

    private fun getSummary(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val rs = conn.prepareStatement("SELECT COUNT(*) as total, SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as pos, SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as neg FROM entry_feedback WHERE entry_id = ?").use { it.setInt(1, entryId); it.executeQuery() }
        rs.next()
        return """{"entry_id":$entryId,"total":${rs.getInt("total")},"positive":${rs.getInt("pos")},"negative":${rs.getInt("neg")}}"""
    }

    private fun getLowRated(limit: Int): String {
        val rs = conn.prepareStatement("SELECT id, summary, type, feedback_score FROM knowledge_entries WHERE feedback_score < 0 AND archived_at IS NULL ORDER BY feedback_score ASC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}","feedback_score":${rs.getDouble("feedback_score")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getTopRated(limit: Int): String {
        val rs = conn.prepareStatement("SELECT id, summary, type, feedback_score FROM knowledge_entries WHERE feedback_score > 0 AND archived_at IS NULL ORDER BY feedback_score DESC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}","feedback_score":${rs.getDouble("feedback_score")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun updateFeedbackScore(entryId: Int) {
        val rs = conn.prepareStatement("SELECT SUM(rating) FROM entry_feedback WHERE entry_id = ?").use { it.setInt(1, entryId); it.executeQuery() }
        val score = if (rs.next()) rs.getDouble(1) else 0.0
        conn.prepareStatement("UPDATE knowledge_entries SET feedback_score = ? WHERE id = ?").use { it.setDouble(1, score); it.setInt(2, entryId); it.executeUpdate() }
    }
}
