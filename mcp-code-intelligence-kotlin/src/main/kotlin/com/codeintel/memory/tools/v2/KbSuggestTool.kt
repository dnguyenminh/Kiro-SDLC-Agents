/** KSA-76: Auto-Suggestions & Related Entries. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection

class KbSuggestTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        val query = args.str("query") ?: return "Error: query required"
        if (query.length < 2) return "Error: query must be at least 2 characters"
        val limit = args.int("limit") ?: 5
        val results = suggest(query, limit)
        if (results.isEmpty()) return """No suggestions for "$query""""
        val lines = mutableListOf("Suggestions (${results.size}):\n")
        results.forEach { lines.add("  #${it.first} [${it.third}] ${it.second.take(60)}") }
        return lines.joinToString("\n")
    }

    fun executeRelated(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return "Error: entry_id required"
        val limit = args.int("limit") ?: 5
        val refresh = args.bool("refresh")
        val results = if (refresh) refreshRelated(entryId, limit) else getRelated(entryId, limit)
        if (results.isEmpty()) return "No related entries found for #$entryId"
        val lines = mutableListOf("Related to #$entryId (${results.size}):\n")
        results.forEach { lines.add("  #${it.id} [${it.type}] ${it.summary.take(60)} (score: ${it.score})") }
        return lines.joinToString("\n")
    }

    private fun suggest(query: String, limit: Int): List<Triple<Int, String, String>> {
        val rs = conn.prepareStatement(
            "SELECT id, summary, type FROM knowledge_entries WHERE summary LIKE ? AND archived_at IS NULL ORDER BY access_count DESC LIMIT ?"
        ).use { it.setString(1, "%$query%"); it.setInt(2, limit); it.executeQuery() }
        val results = mutableListOf<Triple<Int, String, String>>()
        while (rs.next()) results.add(Triple(rs.getInt("id"), rs.getString("summary") ?: "", rs.getString("type") ?: ""))
        return results
    }

    private fun getRelated(entryId: Int, limit: Int): List<RelatedEntry> {
        val cached = getCachedRelated(entryId, limit)
        if (cached.isNotEmpty()) return cached
        return refreshRelated(entryId, limit)
    }

    private fun refreshRelated(entryId: Int, limit: Int): List<RelatedEntry> {
        conn.prepareStatement("DELETE FROM related_entries_cache WHERE entry_id = ?").use { it.setInt(1, entryId); it.executeUpdate() }
        val related = computeRelated(entryId, limit)
        conn.prepareStatement("INSERT OR REPLACE INTO related_entries_cache (entry_id, related_id, score, method) VALUES (?, ?, ?, 'hybrid')").use { ps ->
            for (r in related) { ps.setInt(1, entryId); ps.setInt(2, r.id); ps.setDouble(3, r.score); ps.addBatch() }
            ps.executeBatch()
        }
        return related
    }

    private fun computeRelated(entryId: Int, limit: Int): List<RelatedEntry> {
        val entry = getEntry(entryId) ?: return emptyList()
        val scores = mutableMapOf<Int, Double>()
        scoreByTags(entry, scores)
        scoreByGraph(entryId, scores)
        scores.remove(entryId)
        return scores.entries.sortedByDescending { it.value }.take(limit).mapNotNull { (id, score) ->
            val e = getEntry(id) ?: return@mapNotNull null
            RelatedEntry(id, e.second, e.third, score)
        }
    }

    private fun scoreByTags(entry: Triple<Int, String, String>, scores: MutableMap<Int, Double>) {
        val tags = entry.third.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (tags.isEmpty()) return
        for (tag in tags) {
            val rs = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE id != ? AND archived_at IS NULL AND tags LIKE ?").use { it.setInt(1, entry.first); it.setString(2, "%$tag%"); it.executeQuery() }
            while (rs.next()) scores[rs.getInt(1)] = (scores[rs.getInt(1)] ?: 0.0) + 0.4
        }
    }

    private fun scoreByGraph(entryId: Int, scores: MutableMap<Int, Double>) {
        try {
            val rs = conn.prepareStatement("SELECT target_id FROM knowledge_graph_edges WHERE source_id = ? UNION SELECT source_id FROM knowledge_graph_edges WHERE target_id = ?").use { it.setInt(1, entryId); it.setInt(2, entryId); it.executeQuery() }
            while (rs.next()) scores[rs.getInt(1)] = (scores[rs.getInt(1)] ?: 0.0) + 0.3
        } catch (_: Exception) { /* graph table may not exist */ }
    }

    private fun getEntry(id: Int): Triple<Int, String, String>? {
        val rs = conn.prepareStatement("SELECT id, summary, tags FROM knowledge_entries WHERE id = ?").use { it.setInt(1, id); it.executeQuery() }
        return if (rs.next()) Triple(rs.getInt("id"), rs.getString("summary") ?: "", rs.getString("tags") ?: "") else null
    }

    private fun getCachedRelated(entryId: Int, limit: Int): List<RelatedEntry> {
        val rs = conn.prepareStatement("SELECT rc.related_id, rc.score, ke.summary, ke.type FROM related_entries_cache rc JOIN knowledge_entries ke ON rc.related_id = ke.id WHERE rc.entry_id = ? ORDER BY rc.score DESC LIMIT ?").use { it.setInt(1, entryId); it.setInt(2, limit); it.executeQuery() }
        val results = mutableListOf<RelatedEntry>()
        while (rs.next()) results.add(RelatedEntry(rs.getInt("related_id"), rs.getString("summary") ?: "", rs.getString("type") ?: "", rs.getDouble("score")))
        return results
    }

    data class RelatedEntry(val id: Int, val summary: String, val type: String, val score: Double)
}
