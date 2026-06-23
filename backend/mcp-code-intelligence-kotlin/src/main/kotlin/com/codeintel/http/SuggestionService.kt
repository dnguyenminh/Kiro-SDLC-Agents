/** Suggestion service — autocomplete suggestions for KB viewer search. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection

/** Provides type-ahead suggestions from entries and tags. */
class SuggestionService(private val conn: Connection) {

    fun suggest(query: String, limit: Int): List<SuggestionItem> {
        if (query.isBlank()) return emptyList()
        val results = mutableListOf<SuggestionItem>()
        results.addAll(suggestFromEntries(query, limit))
        if (results.size < limit) {
            results.addAll(suggestFromTags(query, limit - results.size))
        }
        return results.take(limit)
    }

    private fun suggestFromEntries(query: String, limit: Int): List<SuggestionItem> = runCatching {
        conn.prepareStatement(
            "SELECT id, summary, type FROM knowledge_entries " +
            "WHERE summary LIKE ? AND archived_at IS NULL " +
            "ORDER BY access_count DESC LIMIT ?"
        ).use { stmt ->
            stmt.setString(1, "%$query%")
            stmt.setInt(2, limit)
            val rs = stmt.executeQuery()
            buildList {
                while (rs.next()) add(SuggestionItem(
                    summary = rs.getString("summary") ?: "",
                    type = rs.getString("type") ?: "CONTEXT"
                ))
            }
        }
    }.getOrDefault(emptyList())

    private fun suggestFromTags(query: String, limit: Int): List<SuggestionItem> = runCatching {
        conn.prepareStatement(
            "SELECT tag FROM tag_taxonomy WHERE tag LIKE ? LIMIT ?"
        ).use { stmt ->
            stmt.setString(1, "%$query%")
            stmt.setInt(2, limit)
            val rs = stmt.executeQuery()
            buildList {
                while (rs.next()) add(SuggestionItem(
                    tag = rs.getString("tag"),
                    type = "TAG"
                ))
            }
        }
    }.getOrDefault(emptyList())
}

@Serializable
data class SuggestionItem(
    val summary: String? = null,
    val tag: String? = null,
    val type: String = "CONTEXT"
)
