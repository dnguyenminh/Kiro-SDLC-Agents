/**
 * CoreMemoryManager — manages pinned entries for auto-recall.
 * Pinned entries are injected into agent context on every search.
 * Enforces a 2000-token budget across all pinned entries.
 * Port of Node.js core-memory.ts (KSA-142 F1).
 */
package com.codeintel.memory.core

import java.sql.Connection

data class CoreMemoryConfig(
    val maxTokens: Int = 2000,
    val warningThreshold: Int = 1800,
    val maxPinnedEntries: Int = 10
)

data class PinnedEntrySummary(
    val id: Int,
    val summary: String,
    val tokens: Int,
    val pinOrder: Int
)

data class BudgetStatus(
    val used: Int,
    val remaining: Int,
    val max: Int,
    val warning: Boolean
)

class CoreMemoryManager(
    private val db: Connection,
    private val config: CoreMemoryConfig = CoreMemoryConfig()
) {
    /** Pin an entry. Returns success/failure message. */
    fun pin(entryId: Int): String {
        val entry = getEntry(entryId) ?: return "Error: entry $entryId not found"
        if (entry.pinned) return "Entry $entryId is already pinned"
        if (getPinnedCount() >= config.maxPinnedEntries) {
            return "Error: max pinned entries (${config.maxPinnedEntries}) reached"
        }
        val budget = getRemainingBudget()
        val tokens = countTokens(entry.summary ?: entry.content)
        if (tokens > budget) {
            return "Error: entry needs ~$tokens tokens but only $budget remaining in budget"
        }
        val nextOrder = getNextPinOrder()
        db.prepareStatement(
            "UPDATE knowledge_entries SET pinned = 1, pin_order = ?, updated_at = datetime('now') WHERE id = ?"
        ).use { it.setInt(1, nextOrder); it.setInt(2, entryId); it.executeUpdate() }
        return "Pinned entry $entryId (order: $nextOrder, ~$tokens tokens)"
    }

    /** Unpin an entry. */
    fun unpin(entryId: Int): String {
        val entry = getEntry(entryId) ?: return "Error: entry $entryId not found"
        if (!entry.pinned) return "Entry $entryId is not pinned"
        db.prepareStatement(
            "UPDATE knowledge_entries SET pinned = 0, pin_order = 0, updated_at = datetime('now') WHERE id = ?"
        ).use { it.setInt(1, entryId); it.executeUpdate() }
        return "Unpinned entry $entryId"
    }

    /** List all pinned entries with token usage. */
    fun listPinned(): List<PinnedEntrySummary> {
        val stmt = db.createStatement()
        val rs = stmt.executeQuery(
            "SELECT id, summary, content, pin_order FROM knowledge_entries WHERE pinned = 1 ORDER BY pin_order ASC"
        )
        val results = mutableListOf<PinnedEntrySummary>()
        while (rs.next()) {
            val text = rs.getString("summary") ?: rs.getString("content").take(120)
            results.add(PinnedEntrySummary(
                id = rs.getInt("id"),
                summary = text,
                tokens = countTokens(text),
                pinOrder = rs.getInt("pin_order")
            ))
        }
        rs.close(); stmt.close()
        return results
    }

    /** Reorder a pinned entry to a new position. */
    fun reorder(entryId: Int, newOrder: Int): String {
        val entry = getEntry(entryId) ?: return "Error: entry $entryId not found"
        if (!entry.pinned) return "Error: entry $entryId is not pinned"
        db.prepareStatement(
            "UPDATE knowledge_entries SET pin_order = ?, updated_at = datetime('now') WHERE id = ?"
        ).use { it.setInt(1, newOrder); it.setInt(2, entryId); it.executeUpdate() }
        return "Reordered entry $entryId to position $newOrder"
    }

    /** Get pinned context string for injection into search results. */
    fun getContext(): String {
        val pinned = listPinned()
        if (pinned.isEmpty()) return ""
        val parts = mutableListOf("--- PINNED CONTEXT ---")
        var usedTokens = countTokens(parts[0])
        for (p in pinned) {
            val line = "[#${p.id}] ${p.summary}"
            val lineTokens = countTokens(line)
            if (usedTokens + lineTokens > config.maxTokens) {
                val remaining = config.maxTokens - usedTokens
                parts.add(truncateToFit(line, remaining))
                break
            }
            parts.add(line)
            usedTokens += lineTokens
        }
        parts.add("--- END PINNED ---")
        return parts.joinToString("\n")
    }

    /** Get token budget status. */
    fun getBudgetStatus(): BudgetStatus {
        val used = getUsedTokens()
        return BudgetStatus(
            used = used,
            remaining = config.maxTokens - used,
            max = config.maxTokens,
            warning = used >= config.warningThreshold
        )
    }

    private fun getEntry(id: Int): EntryRow? {
        val ps = db.prepareStatement("SELECT id, summary, content, pinned FROM knowledge_entries WHERE id = ?")
        ps.setInt(1, id)
        val rs = ps.executeQuery()
        val result = if (rs.next()) EntryRow(
            id = rs.getInt("id"),
            summary = rs.getString("summary"),
            content = rs.getString("content") ?: "",
            pinned = rs.getInt("pinned") == 1
        ) else null
        rs.close(); ps.close()
        return result
    }

    private fun getPinnedCount(): Int {
        val rs = db.createStatement().executeQuery("SELECT COUNT(*) FROM knowledge_entries WHERE pinned = 1")
        val count = if (rs.next()) rs.getInt(1) else 0
        rs.close()
        return count
    }

    private fun getNextPinOrder(): Int {
        val rs = db.createStatement().executeQuery("SELECT MAX(pin_order) FROM knowledge_entries WHERE pinned = 1")
        val mx = if (rs.next()) rs.getInt(1) else 0
        rs.close()
        return mx + 1
    }

    private fun getUsedTokens(): Int {
        val rs = db.createStatement().executeQuery("SELECT summary, content FROM knowledge_entries WHERE pinned = 1")
        var total = 0
        while (rs.next()) {
            total += countTokens(rs.getString("summary") ?: rs.getString("content"))
        }
        rs.close()
        return total
    }

    private fun getRemainingBudget(): Int = config.maxTokens - getUsedTokens()

    private data class EntryRow(val id: Int, val summary: String?, val content: String, val pinned: Boolean)
}

/** Approximate token count: chars / 4. */
fun countTokens(text: String): Int = text.length / 4

/** Truncate text to fit within token budget. */
fun truncateToFit(text: String, maxTokens: Int): String {
    val maxChars = maxTokens * 4
    return if (text.length <= maxChars) text else text.take(maxChars) + "..."
}
