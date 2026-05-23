/** Unit tests for QualityGate — content validation before KB ingest. */
package com.codeintel.memory.search

import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class QualityGateTest {

    private fun createDb(): java.sql.Connection {
        val conn = DriverManager.getConnection("jdbc:sqlite::memory:")
        conn.createStatement().execute("""
            CREATE TABLE knowledge_entries (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              content TEXT NOT NULL,
              archived INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """.trimIndent())
        return conn
    }

    @Test
    fun `rejects content shorter than minLength`() {
        val conn = createDb()
        val gate = QualityGate(conn)
        val result = gate.validate("short", IngestMeta())
        assertEquals("reject", result.decision)
        assertEquals(0, result.score)
        assertTrue(result.message!!.contains("too short"))
    }

    @Test
    fun `accepts well-formed content with metadata`() {
        val conn = createDb()
        val gate = QualityGate(conn)
        val content = "# Architecture Decision\n\n" +
            "We decided to use SQLite for local storage because it requires no server.\n" +
            "- Simple deployment\n- No network dependency\n" +
            "Decision: Use SQLite for all local KB storage."
        val meta = IngestMeta(tags = "architecture,decision", type = "DECISION", source = "meeting-notes")
        val result = gate.validate(content, meta)
        assertEquals("accept", result.decision)
        assertTrue(result.score >= 50)
    }

    @Test
    fun `warns on low quality content`() {
        val conn = createDb()
        val gate = QualityGate(conn)
        // Content long enough to get 30+ score (need ~375 chars for 30 from length alone)
        // Or use shorter content with tags to hit warn range (30-50)
        val content = "a".repeat(400) // length score = 400*40/500 = 32
        val result = gate.validate(content, IngestMeta())
        assertEquals("warn", result.decision)
        assertTrue(result.message!!.contains("Low quality"))
    }

    @Test
    fun `detects duplicate content`() {
        val conn = createDb()
        conn.prepareStatement(
            "INSERT INTO knowledge_entries (content) VALUES (?)"
        ).use { stmt ->
            stmt.setString(1, "This is a detailed architecture decision about using SQLite for storage")
            stmt.executeUpdate()
        }
        val gate = QualityGate(conn)
        val result = gate.validate(
            "This is a detailed architecture decision about using SQLite for storage",
            IngestMeta()
        )
        assertEquals("reject", result.decision)
        assertTrue(result.duplicateDetected)
    }

    @Test
    fun `structure detection adds score`() {
        val conn = createDb()
        val gate = QualityGate(conn)
        val withStructure = "# Heading\n\n- Item 1\n- Item 2\n\n```code block```\n" +
            "Some additional content to meet minimum length requirement here and more text to boost length score."
        val meta = IngestMeta(tags = "test")
        val result = gate.validate(withStructure, meta)
        // Length ~100 chars (8pts) + tags(20) + structure(10) = 38 → warn
        assertEquals("warn", result.decision)
        assertTrue(result.score >= 30)
    }

    @Test
    fun `actionable content adds score`() {
        val conn = createDb()
        val gate = QualityGate(conn)
        val content = "TODO: Implement the quality gate feature for KB ingest pipeline. " +
            "Decision: Use trigram-based duplicate detection instead of vector similarity. " +
            "This is a longer content to ensure we get enough length score for the test to pass. " +
            "Adding more text here to reach 500 chars threshold for maximum length score. " +
            "The quality gate validates content before it enters the knowledge base. " +
            "It checks for minimum length, duplicate detection, and overall quality scoring."
        val result = gate.validate(content, IngestMeta(tags = "task", type = "DECISION", source = "meeting"))
        // tags(20) + type(10) + source(10) + actionable(10) + length(~40) = ~90 → accept
        assertEquals("accept", result.decision)
    }

    @Test
    fun `empty content is rejected`() {
        val conn = createDb()
        val gate = QualityGate(conn)
        val result = gate.validate("", IngestMeta())
        assertEquals("reject", result.decision)
        assertEquals(0, result.score)
    }

    @Test
    fun `custom thresholds work`() {
        val conn = createDb()
        val gate = QualityGate(conn, minLength = 10, rejectThreshold = 50, warnThreshold = 80)
        val content = "Short but valid content here"
        val result = gate.validate(content, IngestMeta())
        // Score will be low (no tags, no structure) → reject with threshold 50
        assertEquals("reject", result.decision)
    }

    @Test
    fun `no duplicate when DB is empty`() {
        val conn = createDb()
        val gate = QualityGate(conn)
        val content = "A completely new piece of knowledge that has never been stored before in the system."
        val result = gate.validate(content, IngestMeta(tags = "new"))
        assertFalse(result.duplicateDetected)
    }
}
