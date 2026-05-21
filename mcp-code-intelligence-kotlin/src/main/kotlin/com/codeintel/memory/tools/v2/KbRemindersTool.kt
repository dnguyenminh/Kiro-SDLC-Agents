/** KSA-72: Scheduled Review Reminders. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

class KbRemindersTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "due") {
            "schedule" -> schedule(args)
            "snooze" -> snooze(args)
            "dismiss" -> dismiss(args)
            "complete" -> complete(args)
            "auto_schedule" -> autoScheduleAll()
            "stats" -> getStats()
            else -> getDue(args.int("limit") ?: 20)
        }
    }

    private fun schedule(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val interval = args.int("interval_days") ?: 90
        val assignee = args.str("assignee")
        val nextAt = Instant.now().plus(interval.toLong(), ChronoUnit.DAYS).toString()
        conn.prepareStatement("INSERT OR REPLACE INTO review_reminders (entry_id, interval_days, next_reminder_at, assignee) VALUES (?, ?, ?, ?)").use { it.setInt(1, entryId); it.setInt(2, interval); it.setString(3, nextAt); it.setString(4, assignee); it.executeUpdate() }
        return """{"entry_id":$entryId,"interval_days":$interval,"next_reminder_at":"$nextAt"}"""
    }

    private fun snooze(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val days = args.int("snooze_days") ?: 7
        val nextAt = Instant.now().plus(days.toLong(), ChronoUnit.DAYS).toString()
        conn.prepareStatement("UPDATE review_reminders SET next_reminder_at = ?, snooze_count = snooze_count + 1 WHERE entry_id = ?").use { it.setString(1, nextAt); it.setInt(2, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"snoozed_until":"$nextAt"}"""
    }

    private fun dismiss(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        conn.prepareStatement("UPDATE review_reminders SET is_active = 0 WHERE entry_id = ?").use { it.setInt(1, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"status":"dismissed"}"""
    }

    private fun complete(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val now = Instant.now().toString()
        val interval = conn.prepareStatement("SELECT interval_days FROM review_reminders WHERE entry_id = ?").use { it.setInt(1, entryId); val rs = it.executeQuery(); if (rs.next()) rs.getInt(1) else 90 }
        val nextAt = Instant.now().plus(interval.toLong(), ChronoUnit.DAYS).toString()
        conn.prepareStatement("UPDATE review_reminders SET last_reviewed_at = ?, next_reminder_at = ?, snooze_count = 0 WHERE entry_id = ?").use { it.setString(1, now); it.setString(2, nextAt); it.setInt(3, entryId); it.executeUpdate() }
        conn.prepareStatement("UPDATE knowledge_entries SET last_reviewed_at = ?, staleness_score = 0.0 WHERE id = ?").use { it.setString(1, now); it.setInt(2, entryId); it.executeUpdate() }
        return """{"entry_id":$entryId,"reviewed_at":"$now","next_reminder_at":"$nextAt"}"""
    }

    private fun autoScheduleAll(): String {
        val rs = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE archived_at IS NULL AND id NOT IN (SELECT entry_id FROM review_reminders)").executeQuery()
        var count = 0
        while (rs.next()) {
            val nextAt = Instant.now().plus(90, ChronoUnit.DAYS).toString()
            conn.prepareStatement("INSERT OR IGNORE INTO review_reminders (entry_id, interval_days, next_reminder_at) VALUES (?, 90, ?)").use { it.setInt(1, rs.getInt(1)); it.setString(2, nextAt); it.executeUpdate() }
            count++
        }
        return """{"scheduled":$count}"""
    }

    private fun getStats(): String {
        val total = conn.prepareStatement("SELECT COUNT(*) FROM review_reminders WHERE is_active = 1").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        val due = conn.prepareStatement("SELECT COUNT(*) FROM review_reminders WHERE is_active = 1 AND next_reminder_at <= datetime('now')").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        return """{"total_active":$total,"due_now":$due}"""
    }

    private fun getDue(limit: Int): String {
        val rs = conn.prepareStatement("SELECT rr.entry_id, rr.next_reminder_at, rr.assignee, ke.summary, ke.type FROM review_reminders rr JOIN knowledge_entries ke ON rr.entry_id = ke.id WHERE rr.is_active = 1 AND rr.next_reminder_at <= datetime('now') ORDER BY rr.next_reminder_at ASC LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        val lines = mutableListOf<String>()
        while (rs.next()) {
            lines.add("#${rs.getInt("entry_id")} [${rs.getString("type")}] ${rs.getString("summary")?.take(60)}")
            lines.add("  Due: ${rs.getString("next_reminder_at")} | Assignee: ${rs.getString("assignee") ?: "unassigned"}")
        }
        return if (lines.isEmpty()) "No reminders due." else "Due reminders:\n${lines.joinToString("\n")}"
    }
}
