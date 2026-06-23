/** KSA-77: Faceted Search with Tag Taxonomy. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection

class KbTagsTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "taxonomy") {
            "create" -> createTag(args)
            "tag" -> tagEntry(args)
            "untag" -> untagEntry(args)
            "search" -> searchByTags(args)
            "popular" -> getPopular(args)
            "entry_tags" -> getEntryTags(args)
            else -> getTaxonomy(args)
        }
    }

    private fun createTag(args: JsonObject): String {
        val tag = args.str("tag") ?: return """{"error":"tag required"}"""
        val category = args.str("category") ?: "general"
        val parent = args.str("parent_tag")
        conn.prepareStatement("INSERT OR IGNORE INTO tag_taxonomy (tag, category, parent_tag) VALUES (?, ?, ?)").use { it.setString(1, tag); it.setString(2, category); it.setString(3, parent); it.executeUpdate() }
        return """{"created":"$tag","category":"$category"}"""
    }

    private fun tagEntry(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val tags = (args.str("tags") ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (tags.isEmpty()) return """{"error":"tags required"}"""
        var added = 0
        for (tag in tags) {
            conn.prepareStatement("INSERT OR IGNORE INTO tag_taxonomy (tag) VALUES (?)").use { it.setString(1, tag); it.executeUpdate() }
            val tagId = conn.prepareStatement("SELECT id FROM tag_taxonomy WHERE tag = ?").use { it.setString(1, tag); val rs = it.executeQuery(); if (rs.next()) rs.getInt(1) else null } ?: continue
            conn.prepareStatement("INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)").use { it.setInt(1, entryId); it.setInt(2, tagId); it.executeUpdate() }
            conn.prepareStatement("UPDATE tag_taxonomy SET usage_count = usage_count + 1 WHERE id = ?").use { it.setInt(1, tagId); it.executeUpdate() }
            added++
        }
        return """{"entry_id":$entryId,"tags_added":$added}"""
    }

    private fun untagEntry(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val tags = (args.str("tags") ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }
        var removed = 0
        for (tag in tags) {
            val tagId = conn.prepareStatement("SELECT id FROM tag_taxonomy WHERE tag = ?").use { it.setString(1, tag); val rs = it.executeQuery(); if (rs.next()) rs.getInt(1) else null } ?: continue
            conn.prepareStatement("DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?").use { it.setInt(1, entryId); it.setInt(2, tagId); it.executeUpdate() }
            removed++
        }
        return """{"entry_id":$entryId,"tags_removed":$removed}"""
    }

    private fun searchByTags(args: JsonObject): String {
        val tags = (args.str("tags") ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (tags.isEmpty()) return """{"error":"tags required"}"""
        val operator = args.str("operator") ?: "AND"
        val limit = args.int("limit") ?: 20
        val placeholders = tags.joinToString(",") { "?" }
        val minCount = if (operator == "AND") tags.size else 1
        val ps = conn.prepareStatement("SELECT ke.id, ke.summary, ke.type, COUNT(*) as mc FROM entry_tags et JOIN tag_taxonomy tt ON et.tag_id = tt.id JOIN knowledge_entries ke ON et.entry_id = ke.id WHERE tt.tag IN ($placeholders) AND ke.archived_at IS NULL GROUP BY ke.id HAVING mc >= ? ORDER BY mc DESC LIMIT ?")
        tags.forEachIndexed { i, t -> ps.setString(i + 1, t) }
        ps.setInt(tags.size + 1, minCount); ps.setInt(tags.size + 2, limit)
        val rs = ps.executeQuery()
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}","type":"${rs.getString("type")}"}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getPopular(args: JsonObject): String {
        val limit = args.int("limit") ?: 20
        val rs = conn.prepareStatement("SELECT tag, category, usage_count FROM tag_taxonomy ORDER BY usage_count DESC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"tag":"${rs.getString("tag")}","category":"${rs.getString("category")}","usage_count":${rs.getInt("usage_count")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getEntryTags(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val rs = conn.prepareStatement("SELECT tt.tag, tt.category FROM entry_tags et JOIN tag_taxonomy tt ON et.tag_id = tt.id WHERE et.entry_id = ?").use { it.setInt(1, entryId); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"tag":"${rs.getString("tag")}","category":"${rs.getString("category")}"}""")
        return "[${items.joinToString(",")}]"
    }

    private fun getTaxonomy(args: JsonObject): String {
        val category = args.str("category")
        val rs = if (category != null) conn.prepareStatement("SELECT tag, category, parent_tag, usage_count FROM tag_taxonomy WHERE category = ? ORDER BY tag").use { it.setString(1, category); it.executeQuery() }
        else conn.prepareStatement("SELECT tag, category, parent_tag, usage_count FROM tag_taxonomy ORDER BY category, tag").executeQuery()
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"tag":"${rs.getString("tag")}","category":"${rs.getString("category")}","usage_count":${rs.getInt("usage_count")}}""")
        return "[${items.joinToString(",")}]"
    }
}
