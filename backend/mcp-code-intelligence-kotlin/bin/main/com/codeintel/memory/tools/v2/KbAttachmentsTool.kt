/** KSA-75: File Attachments for knowledge entries. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.io.File
import java.sql.Connection

class KbAttachmentsTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "list") {
            "attach" -> attach(args)
            "remove" -> remove(args)
            "search" -> searchByType(args)
            else -> listAttachments(args)
        }
    }

    private fun attach(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val filePath = args.str("file_path") ?: return """{"error":"file_path required"}"""
        val desc = args.str("description")
        val file = File(filePath)
        val fileName = file.name
        val mime = guessMime(file.extension)
        val size = if (file.exists()) file.length() else 0L
        conn.prepareStatement(
            "INSERT INTO entry_attachments (entry_id, file_path, file_name, mime_type, file_size, description) VALUES (?, ?, ?, ?, ?, ?)"
        ).use { it.setInt(1, entryId); it.setString(2, filePath); it.setString(3, fileName); it.setString(4, mime); it.setLong(5, size); it.setString(6, desc); it.executeUpdate() }
        return """{"entry_id":$entryId,"file_name":"$fileName","mime_type":"$mime"}"""
    }

    private fun remove(args: JsonObject): String {
        val attId = args.int("attachment_id") ?: return """{"error":"attachment_id required"}"""
        conn.prepareStatement("DELETE FROM entry_attachments WHERE id = ?").use { it.setInt(1, attId); it.executeUpdate() }
        return """{"deleted":$attId}"""
    }

    private fun searchByType(args: JsonObject): String {
        val mime = args.str("mime_prefix") ?: "image/"
        val rs = conn.prepareStatement("SELECT id, entry_id, file_name, mime_type FROM entry_attachments WHERE mime_type LIKE ? LIMIT 50").use { it.setString(1, "$mime%"); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"entry_id":${rs.getInt("entry_id")},"file_name":"${rs.getString("file_name")}"}""")
        return "[${items.joinToString(",")}]"
    }

    private fun listAttachments(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val rs = conn.prepareStatement("SELECT id, file_path, file_name, mime_type, file_size, description FROM entry_attachments WHERE entry_id = ?").use { it.setInt(1, entryId); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"id":${rs.getInt("id")},"file_name":"${rs.getString("file_name")}","mime_type":"${rs.getString("mime_type")}","file_size":${rs.getLong("file_size")}}""")
        return "[${items.joinToString(",")}]"
    }

    private fun guessMime(ext: String): String = when (ext.lowercase()) {
        "png" -> "image/png"; "jpg", "jpeg" -> "image/jpeg"; "gif" -> "image/gif"
        "pdf" -> "application/pdf"; "md" -> "text/markdown"; "txt" -> "text/plain"
        "json" -> "application/json"; "drawio" -> "application/xml"
        else -> "application/octet-stream"
    }
}
