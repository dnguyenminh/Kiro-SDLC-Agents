/** KSA-79: Citation Tracking & Source Attribution. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection

class KbCitationsTool(private val conn: Connection) {

    fun executeCite(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val citedBy = args.str("cited_by") ?: return """{"error":"cited_by required"}"""
        val context = args.str("context")
        conn.prepareStatement("INSERT INTO citations (entry_id, cited_by, context) VALUES (?, ?, ?)").use { it.setInt(1, entryId); it.setString(2, citedBy); it.setString(3, context); it.executeUpdate() }
        return """{"entry_id":$entryId,"cited_by":"$citedBy","status":"recorded"}"""
    }

    fun execute(args: JsonObject): String {
        val limit = args.int("limit") ?: 10
        return when (args.str("action") ?: "most_cited") {
            "entry" -> getCitationsForEntry(args, limit)
            "uncited" -> getUncited(limit)
            "by_agent" -> getCitationsByAgent(args, limit)
            else -> getMostCited(limit)
        }
    }

    private fun getCitationsForEntry(args: JsonObject, limit: Int): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val rs = conn.prepareStatement("SELECT cited_by, context, cited_at FROM citations WHERE entry_id = ? ORDER BY cited_at DESC LIMIT ?").use { it.setInt(1, entryId); it.setInt(2, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"cited_by":"${rs.getString("cited_by")}","cited_at":"${rs.getString("cited_at")}"}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getMostCited(limit: Int): String {
        val rs = conn.prepareStatement("SELECT c.entry_id, ke.summary, ke.type, COUNT(*) as cnt FROM citations c JOIN knowledge_entries ke ON c.entry_id = ke.id GROUP BY c.entry_id ORDER BY cnt DESC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"entry_id":${rs.getInt("entry_id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}","citations":${rs.getInt("cnt")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getUncited(limit: Int): String {
        val rs = conn.prepareStatement("SELECT ke.id, ke.summary, ke.type FROM knowledge_entries ke LEFT JOIN citations c ON ke.id = c.entry_id WHERE c.id IS NULL AND ke.archived_at IS NULL ORDER BY ke.access_count DESC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}","type":"${rs.getString("type")}"}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getCitationsByAgent(args: JsonObject, limit: Int): String {
        val agent = args.str("agent") ?: return """{"error":"agent required"}"""
        val rs = conn.prepareStatement("SELECT c.entry_id, ke.summary, c.cited_at FROM citations c JOIN knowledge_entries ke ON c.entry_id = ke.id WHERE c.cited_by = ? ORDER BY c.cited_at DESC LIMIT ?").use { it.setString(1, agent); it.setInt(2, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"entry_id":${rs.getInt("entry_id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}"}""")
        return "[${items.joinToString(",")}]"
    }
}
