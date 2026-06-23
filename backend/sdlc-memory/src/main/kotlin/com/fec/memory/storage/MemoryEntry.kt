package com.fec.memory.storage

import java.sql.ResultSet

/**
 * Data class representing a memory entry.
 */
data class MemoryEntry(
    val id: Long = 0,
    val tier: String,
    val ticketKey: String? = null,
    val agent: String? = null,
    val category: String,
    val title: String,
    val content: String,
    val metadata: String = "{}",
    val importance: Double = 0.5,
    val accessCount: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
) {
    companion object {
        fun fromResultSet(rs: ResultSet): MemoryEntry {
            return MemoryEntry(
                id = rs.getLong("id"),
                tier = rs.getString("tier"),
                ticketKey = rs.getString("ticket_key"),
                agent = rs.getString("agent"),
                category = rs.getString("category"),
                title = rs.getString("title"),
                content = rs.getString("content"),
                metadata = rs.getString("metadata") ?: "{}",
                importance = rs.getDouble("importance"),
                accessCount = rs.getInt("access_count"),
                createdAt = rs.getString("created_at"),
                updatedAt = rs.getString("updated_at"),
            )
        }
    }
}
