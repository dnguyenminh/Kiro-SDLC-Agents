/** Unit tests for AgentScopeFilter — tag-based KB isolation. */
package com.codeintel.memory.search

import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeSearchResult
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AgentScopeFilterTest {

    private fun createDb(): java.sql.Connection {
        val conn = DriverManager.getConnection("jdbc:sqlite::memory:")
        conn.createStatement().execute("""
            CREATE TABLE agent_scope_config (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              agent_role TEXT NOT NULL UNIQUE,
              tag_set TEXT NOT NULL DEFAULT '[]',
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """.trimIndent())
        conn.createStatement().execute("""
            INSERT INTO agent_scope_config (agent_role, tag_set) VALUES
              ('QA', '["testing","qa","test-plan","bug"]'),
              ('DEV', '["code","api","architecture","design"]'),
              ('BA', '["requirement","business","process"]')
        """.trimIndent())
        return conn
    }

    private fun makeResult(tags: String, id: Long = 1): KnowledgeSearchResult {
        return KnowledgeSearchResult(
            entry = KnowledgeEntry(id = id, content = "test", summary = "test", type = "CONTEXT", tags = tags),
            score = 1.0
        )
    }

    @Test
    fun `getScope returns correct tags for known role`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        val scope = filter.getScope("QA")
        assertNotNull(scope)
        assertEquals("QA", scope.role)
        assertTrue(scope.tags.contains("testing"))
        assertTrue(scope.tags.contains("bug"))
    }

    @Test
    fun `getScope returns null for unknown role`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        assertNull(filter.getScope("UNKNOWN"))
    }

    @Test
    fun `filter keeps entries matching agent tags`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        val results = listOf(
            makeResult("testing,qa", 1),
            makeResult("code,api", 2),
            makeResult("requirement", 3),
        )
        val filtered = filter.filter(results, "QA")
        assertEquals(1, filtered.size)
        assertEquals(1L, filtered[0].entry.id)
    }

    @Test
    fun `filter keeps untagged entries for all roles`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        val results = listOf(
            makeResult("", 1),  // untagged
            makeResult("code", 2),
        )
        val filtered = filter.filter(results, "QA")
        assertEquals(1, filtered.size) // only untagged passes
        assertEquals(1L, filtered[0].entry.id)
    }

    @Test
    fun `filter returns all results for unknown role`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        val results = listOf(makeResult("testing", 1), makeResult("code", 2))
        val filtered = filter.filter(results, "UNKNOWN")
        assertEquals(2, filtered.size)
    }

    @Test
    fun `updateScope persists and updates cache`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        filter.updateScope("QA", listOf("testing", "qa", "e2e", "performance"))
        val scope = filter.getScope("QA")
        assertNotNull(scope)
        assertEquals(4, scope.tags.size)
        assertTrue(scope.tags.contains("e2e"))
    }

    @Test
    fun `case insensitive role lookup`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        assertNotNull(filter.getScope("qa"))
        assertNotNull(filter.getScope("Qa"))
        assertNotNull(filter.getScope("QA"))
    }

    @Test
    fun `filter handles mixed case tags`() {
        val conn = createDb()
        val filter = AgentScopeFilter(conn)
        val results = listOf(makeResult("Testing,QA", 1))
        val filtered = filter.filter(results, "QA")
        assertEquals(1, filtered.size) // "testing" matches after lowercase
    }
}
