/** Reminder service — due review reminders for KB viewer dashboard. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection

/** Queries review_reminders and knowledge_entries for overdue reviews. */
class ReminderService(private val conn: Connection) {

    fun getDueReminders(): List<ReminderEntry> = runCatching {
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(
                "SELECT e.id, e.summary, e.updated_at as last_reviewed_at, " +
                "CAST(julianday('now') - julianday(e.updated_at) AS INT) as days_overdue " +
                "FROM knowledge_entries e " +
                "WHERE e.archived_at IS NULL " +
                "AND julianday('now') - julianday(e.updated_at) > 90 " +
                "ORDER BY e.updated_at ASC LIMIT 20"
            )
            buildList {
                while (rs.next()) add(ReminderEntry(
                    id = rs.getLong("id"),
                    summary = rs.getString("summary") ?: "",
                    last_reviewed_at = rs.getString("last_reviewed_at") ?: "Never",
                    days_overdue = rs.getInt("days_overdue")
                ))
            }
        }
    }.getOrDefault(emptyList())
}

@Serializable
data class ReminderEntry(
    val id: Long,
    val summary: String,
    val last_reviewed_at: String,
    val days_overdue: Int
)
