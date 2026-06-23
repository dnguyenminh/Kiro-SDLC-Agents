/** Tag overlap linking — finds entries sharing >= N tags. KSA-190. */
package com.codeintel.memory.ingest.autolink

import java.sql.Connection

class TagStrategy(private val conn: Connection) : LinkingStrategy {

    override val name = "tag"

    override fun isEnabled(config: AutoLinkConfig): Boolean =
        config.tag.enabled

    override fun findCandidates(entryId: Long, config: AutoLinkConfig): List<CandidateEdge> {
        val myTags = getEntryTags(entryId)
        if (myTags.size < config.tag.minOverlap) return emptyList()

        val rows = findEntriesWithOverlappingTags(entryId, myTags)
        return rows
            .mapNotNull { (otherId, otherTags) ->
                buildTagEdge(myTags, otherTags, otherId, config)
            }
            .sortedByDescending { it.score }
            .take(config.tag.maxEdges)
    }

    private fun getEntryTags(entryId: Long): List<String> {
        val ps = conn.prepareStatement(
            "SELECT tags FROM knowledge_entries WHERE id = ?"
        )
        ps.setLong(1, entryId)
        val rs = ps.executeQuery()
        val tags = if (rs.next()) parseTags(rs.getString("tags")) else emptyList()
        rs.close(); ps.close()
        return tags
    }

    private fun findEntriesWithOverlappingTags(
        entryId: Long,
        myTags: List<String>
    ): List<Pair<Long, List<String>>> {
        val conditions = myTags.joinToString(" OR ") { "tags LIKE ?" }
        val sql = """
            SELECT id, tags FROM knowledge_entries
            WHERE id != ? AND archived_at IS NULL AND ($conditions)
        """.trimIndent()
        val ps = conn.prepareStatement(sql)
        ps.setLong(1, entryId)
        myTags.forEachIndexed { i, tag -> ps.setString(i + 2, "%$tag%") }
        val rs = ps.executeQuery()
        val results = mutableListOf<Pair<Long, List<String>>>()
        while (rs.next()) {
            results.add(rs.getLong("id") to parseTags(rs.getString("tags")))
        }
        rs.close(); ps.close()
        return results
    }

    private fun buildTagEdge(
        myTags: List<String>,
        otherTags: List<String>,
        otherId: Long,
        config: AutoLinkConfig
    ): CandidateEdge? {
        val shared = myTags.filter { it in otherTags }
        if (shared.size < config.tag.minOverlap) return null
        val union = (myTags + otherTags).toSet()
        val jaccard = shared.size.toDouble() / union.size
        return CandidateEdge(
            targetId = otherId,
            relation = AutoLinkRelations.SHARES_TAG,
            score = jaccard,
            metadata = mapOf("shared_tags" to shared, "overlap_count" to shared.size)
        )
    }

    private fun parseTags(raw: String?): List<String> =
        raw?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()
}
