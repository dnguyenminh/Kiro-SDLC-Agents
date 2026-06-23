/** Full-text search fallback linking. KSA-190. */
package com.codeintel.memory.ingest.autolink

import java.sql.Connection
import kotlin.math.abs
import kotlin.math.min

class FtsStrategy(private val conn: Connection) : LinkingStrategy {

    override val name = "fts"

    override fun isEnabled(config: AutoLinkConfig): Boolean =
        config.fts.enabled

    override fun findCandidates(entryId: Long, config: AutoLinkConfig): List<CandidateEdge> {
        val summary = getEntrySummary(entryId) ?: return emptyList()
        val words = extractKeywords(summary)
        if (words.isEmpty()) return emptyList()

        val query = words.joinToString(" OR ")
        return executeFtsQuery(entryId, query, words, config)
    }

    private fun getEntrySummary(entryId: Long): String? {
        val ps = conn.prepareStatement(
            "SELECT summary FROM knowledge_entries WHERE id = ?"
        )
        ps.setLong(1, entryId)
        val rs = ps.executeQuery()
        val summary = if (rs.next()) rs.getString("summary") else null
        rs.close(); ps.close()
        return summary
    }

    private fun extractKeywords(summary: String): List<String> {
        return summary
            .split(Regex("\\s+"))
            .map { it.replace(Regex("[^a-zA-Z0-9]"), "").lowercase() }
            .filter { it.length > 3 && it !in STOPWORDS }
            .take(5)
    }

    private fun executeFtsQuery(
        entryId: Long,
        query: String,
        words: List<String>,
        config: AutoLinkConfig
    ): List<CandidateEdge> {
        return try {
            val sql = """
                SELECT ke.id, rank FROM knowledge_fts
                JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
                WHERE knowledge_fts MATCH ? AND ke.id != ?
                  AND ke.archived_at IS NULL
                ORDER BY rank LIMIT 10
            """.trimIndent()
            val ps = conn.prepareStatement(sql)
            ps.setString(1, query)
            ps.setLong(2, entryId)
            val rs = ps.executeQuery()
            val rows = mutableListOf<Pair<Long, Double>>()
            while (rs.next()) {
                rows.add(rs.getLong("id") to rs.getDouble("rank"))
            }
            rs.close(); ps.close()
            normalizeAndBuild(rows, words, config)
        } catch (_: Exception) {
            emptyList() // FTS may fail on malformed queries
        }
    }

    private fun normalizeAndBuild(
        rows: List<Pair<Long, Double>>,
        words: List<String>,
        config: AutoLinkConfig
    ): List<CandidateEdge> {
        if (rows.isEmpty()) return emptyList()
        val maxRank = abs(rows.first().second).coerceAtLeast(1.0)
        return rows.map { (id, rank) ->
            val score = min(1.0, abs(rank) / maxRank)
            CandidateEdge(
                targetId = id,
                relation = AutoLinkRelations.TOPIC_OVERLAP,
                score = score,
                metadata = mapOf("query_words" to words, "fts_rank" to rank)
            )
        }.take(config.fts.maxEdges)
    }

    companion object {
        private val STOPWORDS = setOf(
            "this", "that", "with", "from", "have", "been",
            "will", "would", "could", "should", "their", "there",
            "where", "when", "what", "which", "about", "into",
            "more", "some", "than", "them", "then", "these",
            "they", "were", "your"
        )
    }
}
