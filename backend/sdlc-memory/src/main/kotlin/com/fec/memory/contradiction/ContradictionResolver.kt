/** ContradictionResolver for sdlc-memory — detects conflicting memories on ingest.
 *
 * Strategy 1: validity_status marking (ACTIVE/SUPERSEDED)
 * Strategy 2: LLM consolidation (off when no endpoint)
 * Strategy 3: SUPERSEDES graph edges
 */
package com.fec.memory.contradiction

import com.fec.memory.graph.KnowledgeGraph
import com.fec.memory.search.SearchResult
import mu.KotlinLogging
import java.sql.Connection

private val logger = KotlinLogging.logger {}

data class ContradictionConfig(
    val enableStatusMarking: Boolean = true,
    val enableLlmConsolidation: Boolean = false,
    val enableGraphSupersedes: Boolean = true,
    val llmEndpoint: String? = null,
) {
    val isLlmActive: Boolean get() = enableLlmConsolidation && llmEndpoint != null
}

data class ResolutionResult(
    val resolved: Int = 0,
    val supersededIds: List<Long> = emptyList(),
    val edgesCreated: Int = 0,
    val signal: String? = null,
)

class ContradictionResolver(
    private val conn: Connection,
    private val graph: KnowledgeGraph,
    private var config: ContradictionConfig = ContradictionConfig(),
) {
    init { ensureSchema() }

    fun updateConfig(newConfig: ContradictionConfig) { config = newConfig }

    /** On ingest: detect if new memory contradicts existing ones. */
    fun detectAndResolve(newMemoryId: Long): ResolutionResult {
        val entry = getMemory(newMemoryId) ?: return ResolutionResult()
        val signal = detectSignal(entry.content) ?: return ResolutionResult()
        val conflicting = findConflicting(entry, newMemoryId)
        if (conflicting.isEmpty()) return ResolutionResult()

        val confidence = computeConfidence(entry, conflicting, signal)
        if (confidence < 0.6) {
            logAudit(newMemoryId, emptyList(), signal)
            return ResolutionResult(signal = signal)
        }

        val superseded = mutableListOf<Long>()
        var edges = 0
        for (old in conflicting) {
            if (config.enableStatusMarking) { markSuperseded(old.id, newMemoryId); superseded.add(old.id) }
            if (config.enableGraphSupersedes) { graph.addEdge(newMemoryId, old.id, "SUPERSEDES", confidence); persistEdge(newMemoryId, old.id, confidence); edges++ }
        }
        logAudit(newMemoryId, superseded, signal)
        return ResolutionResult(conflicting.size, superseded, edges, signal)
    }

    /** Post-search: filter superseded entries from results. */
    fun filterSuperseded(results: List<SearchResult>): List<SearchResult> {
        if (!config.enableStatusMarking && !config.enableGraphSupersedes) return results
        val invalidIds = mutableSetOf<Long>()
        if (config.enableStatusMarking) {
            for (r in results) { if (getValidityStatus(r.entry.id) == "SUPERSEDED") invalidIds.add(r.entry.id) }
        }
        if (config.enableGraphSupersedes) {
            for (r in results) {
                if (r.entry.id in invalidIds) continue
                if (hasSupersedingEdge(r.entry.id)) invalidIds.add(r.entry.id)
            }
        }
        return results.filter { it.entry.id !in invalidIds }
    }

    fun revalidate(memoryId: Long) {
        conn.prepareStatement("UPDATE memories SET validity_status='ACTIVE',superseded_by=NULL,updated_at=datetime('now') WHERE id=?")
            .use { it.setLong(1, memoryId); it.executeUpdate() }
    }

    // --- Private ---

    private fun ensureSchema() {
        listOf(
            "ALTER TABLE memories ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE'",
            "ALTER TABLE memories ADD COLUMN superseded_by INTEGER DEFAULT NULL",
        ).forEach { try { conn.createStatement().execute(it) } catch (_: Exception) {} }
        try { conn.createStatement().execute("CREATE INDEX IF NOT EXISTS idx_mem_validity ON memories(validity_status)") } catch (_: Exception) {}
    }

    private data class MemSnapshot(val id: Long, val content: String, val title: String, val category: String, val ticketKey: String?, val createdAt: String?)

    private fun getMemory(id: Long): MemSnapshot? {
        val rs = conn.prepareStatement("SELECT id,content,title,category,ticket_key,created_at FROM memories WHERE id=?")
            .also { it.setLong(1, id) }.executeQuery()
        return if (rs.next()) MemSnapshot(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)) else null
    }

    private fun findConflicting(entry: MemSnapshot, excludeId: Long): List<MemSnapshot> {
        if (entry.ticketKey != null) {
            val list = findByTicketAndCategory(entry.ticketKey, entry.category, excludeId)
            if (list.isNotEmpty()) return list
        }
        return findByFts(entry.title, excludeId)
    }

    private fun findByTicketAndCategory(ticket: String, category: String, excludeId: Long): List<MemSnapshot> {
        val rs = conn.prepareStatement(
            "SELECT id,content,title,category,ticket_key,created_at FROM memories WHERE ticket_key=? AND category=? AND id!=? AND (validity_status='ACTIVE' OR validity_status IS NULL) ORDER BY created_at DESC LIMIT 20"
        ).also { it.setString(1, ticket); it.setString(2, category); it.setLong(3, excludeId) }.executeQuery()
        val list = mutableListOf<MemSnapshot>()
        while (rs.next()) list.add(MemSnapshot(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)))
        return list
    }

    private fun findByFts(title: String, excludeId: Long): List<MemSnapshot> {
        val q = title.replace(Regex("[^\\w\\s]"), " ").trim().take(60)
        if (q.isBlank()) return emptyList()
        return try {
            val rs = conn.prepareStatement(
                "SELECT m.id,m.content,m.title,m.category,m.ticket_key,m.created_at FROM memories_fts JOIN memories m ON memories_fts.rowid=m.id WHERE memories_fts MATCH ? AND m.id!=? AND (m.validity_status='ACTIVE' OR m.validity_status IS NULL) ORDER BY rank LIMIT 10"
            ).also { it.setString(1, q); it.setLong(2, excludeId) }.executeQuery()
            val list = mutableListOf<MemSnapshot>()
            while (rs.next()) list.add(MemSnapshot(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)))
            list
        } catch (_: Exception) { emptyList() }
    }

    private fun detectSignal(content: String): String? {
        val lower = content.lowercase()
        return SIGNALS.firstOrNull { lower.contains(it) }
    }

    private fun computeConfidence(entry: MemSnapshot, conflicting: List<MemSnapshot>, signal: String): Double {
        var c = 0.5
        if (STRONG.any { signal.contains(it) }) c += 0.2
        if (conflicting.all { (it.createdAt ?: "") < (entry.createdAt ?: "") }) c += 0.15
        if (conflicting.any { it.ticketKey == entry.ticketKey }) c += 0.1
        return c.coerceAtMost(1.0)
    }

    private fun markSuperseded(oldId: Long, newId: Long) {
        conn.prepareStatement("UPDATE memories SET validity_status='SUPERSEDED',superseded_by=?,updated_at=datetime('now') WHERE id=?")
            .use { it.setLong(1, newId); it.setLong(2, oldId); it.executeUpdate() }
    }

    private fun persistEdge(sourceId: Long, targetId: Long, weight: Double) {
        conn.prepareStatement("INSERT INTO graph_edges(source_id,target_id,relation,weight) VALUES(?,?,?,?)")
            .use { it.setLong(1, sourceId); it.setLong(2, targetId); it.setString(3, "SUPERSEDES"); it.setDouble(4, weight); it.executeUpdate() }
    }

    private fun getValidityStatus(id: Long): String {
        val rs = conn.prepareStatement("SELECT validity_status FROM memories WHERE id=?").also { it.setLong(1, id) }.executeQuery()
        return if (rs.next()) (rs.getString(1) ?: "ACTIVE") else "ACTIVE"
    }

    private fun hasSupersedingEdge(targetId: Long): Boolean {
        val rs = conn.prepareStatement("SELECT 1 FROM graph_edges WHERE target_id=? AND relation='SUPERSEDES' LIMIT 1")
            .also { it.setLong(1, targetId) }.executeQuery()
        return rs.next()
    }

    private fun logAudit(newId: Long, superseded: List<Long>, signal: String) {
        logger.info { "Contradiction resolved: new=$newId superseded=$superseded signal=$signal" }
    }

    companion object {
        private val SIGNALS = listOf(
            "hủy bỏ", "hủy", "thay thế", "không còn", "đã xóa", "sửa lại", "thay đổi",
            "dừng", "ngừng", "loại bỏ", "deprecated", "không dùng nữa",
            "cancel", "revoke", "supersede", "replace", "override", "no longer",
            "removed", "deleted", "changed to", "updated to", "stop using",
            "obsolete", "invalid", "was wrong", "correction"
        )
        private val STRONG = listOf("hủy bỏ", "cancel", "replace", "supersede", "deprecated", "obsolete", "revoke")
    }
}
