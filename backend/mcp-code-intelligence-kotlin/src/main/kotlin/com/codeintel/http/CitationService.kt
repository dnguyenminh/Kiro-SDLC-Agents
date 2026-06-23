/** Citation service — most cited entries for KB viewer. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection

/** Queries citations table for viewer display. */
class CitationService(private val conn: Connection) {

    fun getMostCited(limit: Int): List<CitedEntry> = runCatching {
        conn.prepareStatement(
            "SELECT e.id, e.summary, COUNT(c.id) as citation_count " +
            "FROM citations c JOIN knowledge_entries e ON c.entry_id = e.id " +
            "GROUP BY e.id ORDER BY citation_count DESC LIMIT ?"
        ).use { stmt ->
            stmt.setInt(1, limit)
            val rs = stmt.executeQuery()
            buildList {
                while (rs.next()) add(CitedEntry(
                    id = rs.getLong("id"),
                    summary = rs.getString("summary") ?: "",
                    citation_count = rs.getInt("citation_count")
                ))
            }
        }
    }.getOrDefault(emptyList())
}

@Serializable
data class CitedEntry(
    val id: Long,
    val summary: String,
    val citation_count: Int
)
