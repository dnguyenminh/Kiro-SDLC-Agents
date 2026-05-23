/** Unit tests for WorkingTierExpiry — lazy auto-expiry of stale entries. */
package com.codeintel.memory.search

import java.sql.DriverManager
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WorkingTierExpiryTest {

    private fun createDb(): java.sql.Connection {
        val conn = DriverManager.getConnection("jdbc:sqlite::memory:")
        conn.createStatement().execute("""
            CREATE TABLE knowledge_entries (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              content TEXT NOT NULL,
              tier TEXT NOT NULL DEFAULT 'WORKING',
              archived INTEGER NOT NULL DEFAULT 0,
              pinned INTEGER NOT NULL DEFAULT 0,
              quality_score INTEGER DEFAULT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """.trimIndent())
        return conn
    }

    private fun insertEntry(
        conn: java.sql.Connection,
        tier: String = "WORKING",
        archived: Int = 0,
        pinned: Int = 0,
        qualityScore: Int? = null,
        hoursAgo: Long = 48
    ): Long {
        val createdAt = Instant.now().minus(hoursAgo, ChronoUnit.HOURS).toString()
        conn.prepareStatement(
            "INSERT INTO knowledge_entries (content, tier, archived, pinned, quality_score, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).use { stmt ->
            stmt.setString(1, "test content")
            stmt.setString(2, tier)
            stmt.setInt(3, archived)
            stmt.setInt(4, pinned)
            if (qualityScore != null) stmt.setInt(5, qualityScore) else stmt.setNull(5, java.sql.Types.INTEGER)
            stmt.setString(6, createdAt)
            stmt.executeUpdate()
        }
        return conn.createStatement().executeQuery("SELECT last_insert_rowid()").use { rs ->
            rs.next(); rs.getLong(1)
        }
    }

    @Test
    fun `promotes high quality stale entries to EPISODIC`() {
        val conn = createDb()
        insertEntry(conn, qualityScore = 75, hoursAgo = 48)
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertEquals(1, actions.size)
        assertEquals("promoted", actions[0].action)
        assertEquals("EPISODIC", actions[0].toTier)
    }

    @Test
    fun `archives low quality stale entries`() {
        val conn = createDb()
        insertEntry(conn, qualityScore = 20, hoursAgo = 48)
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertEquals(1, actions.size)
        assertEquals("archived", actions[0].action)
    }

    @Test
    fun `skips pinned entries`() {
        val conn = createDb()
        insertEntry(conn, pinned = 1, qualityScore = 10, hoursAgo = 48)
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertTrue(actions.isEmpty())
    }

    @Test
    fun `skips non-WORKING tier entries`() {
        val conn = createDb()
        insertEntry(conn, tier = "EPISODIC", qualityScore = 10, hoursAgo = 48)
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertTrue(actions.isEmpty())
    }

    @Test
    fun `skips already archived entries`() {
        val conn = createDb()
        insertEntry(conn, archived = 1, qualityScore = 10, hoursAgo = 48)
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertTrue(actions.isEmpty())
    }

    @Test
    fun `skips entries newer than expiryHours`() {
        val conn = createDb()
        insertEntry(conn, qualityScore = 10, hoursAgo = 2) // only 2 hours old
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertTrue(actions.isEmpty())
    }

    @Test
    fun `processes multiple entries in one call`() {
        val conn = createDb()
        insertEntry(conn, qualityScore = 80, hoursAgo = 48) // promote
        insertEntry(conn, qualityScore = 15, hoursAgo = 48) // archive
        insertEntry(conn, qualityScore = 65, hoursAgo = 48) // promote
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertEquals(3, actions.size)
        assertEquals(2, actions.count { it.action == "promoted" })
        assertEquals(1, actions.count { it.action == "archived" })
    }

    @Test
    fun `null quality score treated as 0`() {
        val conn = createDb()
        insertEntry(conn, qualityScore = null, hoursAgo = 48)
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertEquals(1, actions.size)
        assertEquals("archived", actions[0].action)
    }

    @Test
    fun `returns empty list when no stale entries`() {
        val conn = createDb()
        val expiry = WorkingTierExpiry(conn, expiryHours = 24)
        val actions = expiry.processStale()
        assertTrue(actions.isEmpty())
    }
}
