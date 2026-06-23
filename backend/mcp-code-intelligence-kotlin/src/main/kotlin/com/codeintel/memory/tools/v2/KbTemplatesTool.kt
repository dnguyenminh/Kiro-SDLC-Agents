/** KSA-73: Template Enforcement Engine. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection

class KbTemplatesTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "list") {
            "create" -> createTemplate(args)
            "validate" -> validateEntry(args)
            else -> listTemplates()
        }
    }

    private fun createTemplate(args: JsonObject): String {
        val name = args.str("name") ?: return """{"error":"name required"}"""
        val type = args.str("type") ?: return """{"error":"type required"}"""
        val sections = args.str("required_sections") ?: ""
        conn.prepareStatement(
            "INSERT OR REPLACE INTO content_templates (name, type, schema_json, required_sections) VALUES (?, ?, ?, ?)"
        ).use { it.setString(1, name); it.setString(2, type); it.setString(3, """{"required_sections":"$sections"}"""); it.setString(4, sections); it.executeUpdate() }
        return """{"created":"$name","type":"$type"}"""
    }

    private fun validateEntry(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val entry = conn.prepareStatement("SELECT content, type FROM knowledge_entries WHERE id = ?").use { it.setInt(1, entryId); val rs = it.executeQuery(); if (rs.next()) Pair(rs.getString("content"), rs.getString("type")) else null }
            ?: return """{"error":"entry not found"}"""
        val template = conn.prepareStatement("SELECT id, required_sections FROM content_templates WHERE type = ?").use { it.setString(1, entry.second); val rs = it.executeQuery(); if (rs.next()) Pair(rs.getInt("id"), rs.getString("required_sections")) else null }
            ?: return """{"entry_id":$entryId,"valid":true,"message":"No template for type"}"""
        val sections = template.second.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val violations = sections.filter { !entry.first.lowercase().contains(it.lowercase()) }
        val isValid = violations.isEmpty()
        return """{"entry_id":$entryId,"valid":$isValid,"violations":${violations.map { "\"$it\"" }}}"""
    }

    private fun listTemplates(): String {
        val rs = conn.prepareStatement("SELECT id, name, type, required_sections FROM content_templates ORDER BY name").executeQuery()
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"name":"${rs.getString("name")}","type":"${rs.getString("type")}","required_sections":"${rs.getString("required_sections")}"}""")
        return "[${items.joinToString(",")}]"
    }
}
