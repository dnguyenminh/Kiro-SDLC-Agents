/**
 * WorkingTierExpiry — lazy auto-expiry of stale WORKING tier entries.
 * Runs on every mem_search call (no background threads).
 * Entries older than expiryHours are promoted (quality >= 60) or archived.
 * Pinned entries are exempt from expiry (BR-F1-05).
 */
package com.codeintel.memory.search

import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

/** Action taken on a stale entry. */
data class ExpiryAction(
    val entryId: Long,
    val action: String, // "promoted" or "archived"
    val qualityScore: Int,
    val toTier: String? = null
)

class WorkingTierExpiry(
    private val conn: Connection,
    private val expiryHours: Long = 24,
    private val promoteThreshold: Int = 60
) {

    /** Process stale WORKING entries. Returns actions taken. */
    fun processStale(): List<ExpiryAction> {
        val stale = getStaleEntries()
        if (stale.isEmpty()) return emptyList()

        val actions = mutableListOf<ExpiryAction>()
        conn.autoCommit = false
        try {
            val promoteStmt = conn.prepareStatement(
                "UPDATE knowledge_entries SET tier = 'EPISODIC', updated_at = datetime('now') WHERE id = ?"
            )
            val archiveStmt = conn.prepareStatement(
                "UPDATE knowledge_entries SET archived = 1, updated_at = datetime('now') WHERE id = ?"
            )

            for ((id, score) in stale) {
                if (score >= promoteThreshold) {
                    promoteStmt.setLong(1, id)
                    promoteStmt.executeUpdate()
                    actions.add(ExpiryAction(id, "promoted", score, "EPISODIC"))
                } else {
                    archiveStmt.setLong(1, id)
                    archiveStmt.executeUpdate()
                    actions.add(ExpiryAction(id, "archived", score))
                }
            }
            conn.commit()
        } catch (e: Exception) {
            conn.rollback()
            throw e
        } finally {
            conn.autoCommit = true
        }
        return actions
    }

    /** Find WORKING entries older than expiryHours, excluding pinned. */
    private fun getStaleEntries(): List<Pair<Long, Int>> {
        val cutoff = Instant.now().minus(expiryHours, ChronoUnit.HOURS).toString()
        val results = mutableListOf<Pair<Long, Int>>()
        conn.prepareStatement("""
            SELECT id, quality_score FROM knowledge_entries
            WHERE tier = 'WORKING'
              AND archived = 0
              AND pinned = 0
              AND created_at < ?
            ORDER BY created_at ASC
            LIMIT 100
        """.trimIndent()).use { stmt ->
            stmt.setString(1, cutoff)
            stmt.executeQuery().use { rs ->
                while (rs.next()) {
                    val id = rs.getLong("id")
                    val score = rs.getInt("quality_score")
                    results.add(id to score)
                }
            }
        }
        return results
    }
}
