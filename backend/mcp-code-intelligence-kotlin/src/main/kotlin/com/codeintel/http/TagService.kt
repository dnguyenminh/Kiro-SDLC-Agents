/** Tag service — taxonomy tree and popular tags for KB viewer. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection

/** Queries tag_taxonomy and entry_tags tables for viewer display. */
class TagService(private val conn: Connection) {

    fun getPopular(limit: Int): List<PopularTag> = runCatching {
        conn.prepareStatement(
            "SELECT t.tag, t.category, COUNT(et.entry_id) as usage_count " +
            "FROM tag_taxonomy t LEFT JOIN entry_tags et ON t.id = et.tag_id " +
            "GROUP BY t.id ORDER BY usage_count DESC LIMIT ?"
        ).use { stmt ->
            stmt.setInt(1, limit)
            val rs = stmt.executeQuery()
            buildList {
                while (rs.next()) add(PopularTag(
                    tag = rs.getString("tag"),
                    category = rs.getString("category"),
                    usage_count = rs.getInt("usage_count")
                ))
            }
        }
    }.getOrDefault(emptyList())

    fun getTaxonomy(): TagTaxonomyResponse = runCatching {
        val categories = mutableMapOf<String, MutableList<String>>()
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(
                "SELECT tag, category FROM tag_taxonomy ORDER BY category, tag"
            )
            while (rs.next()) {
                val cat = rs.getString("category") ?: "uncategorized"
                val tag = rs.getString("tag")
                categories.getOrPut(cat) { mutableListOf() }.add(tag)
            }
        }
        TagTaxonomyResponse(categories = categories)
    }.getOrDefault(TagTaxonomyResponse(categories = emptyMap()))
}

@Serializable
data class PopularTag(
    val tag: String,
    val category: String? = null,
    val usage_count: Int = 0
)

@Serializable
data class TagTaxonomyResponse(
    val categories: Map<String, List<String>>
)
