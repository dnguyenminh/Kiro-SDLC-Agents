/** ContradictionResolver — detects and resolves conflicting info in KB.
 *
 * Strategy 1: Metadata/Status marking (on ingest)
 * Strategy 2: LLM consolidation (on search, off if no LLM)
 * Strategy 3: SUPERSEDES graph edges (on ingest + search filter)
 */
package com.codeintel.memory.contradiction

import com.codeintel.memory.repository.GraphRepository
import com.codeintel.memory.models.KnowledgeSearchResult
import java.sql.Connection

class ContradictionResolver(
    private val conn: Connection,
    private val graphRepo: GraphRepository,
    private var config: ContradictionConfig = ContradictionConfig()
) {
    init { ensureSchema() }

    fun updateConfig(newConfig: ContradictionConfig) { config = newConfig }
    fun getConfig(): ContradictionConfig = config

    /** On ingest: detect if new entry contradicts existing ones. */
    fun detectAndResolve(newEntryId: Long): ResolutionResult {
        val entry = getEntry(newEntryId) ?: return ResolutionResult()
        val signal = detectSupersessionSignal(entry.content) ?: return ResolutionResult()
        val conflicting = findConflicting(entry, newEntryId)
        if (conflicting.isEmpty()) return ResolutionResult()

        val confidence = computeConfidence(entry, conflicting, signal)
        val detection = ContradictionDetection(newEntryId, conflicting.map { it.id }, signal, confidence)

        if (confidence < 0.6) {
            logResolution(emptyList(), 0, detection)
            return ResolutionResult(detected = listOf(detection))
        }

        val superseded = mutableListOf<Long>()
        var edgesCreated = 0
        for (old in conflicting) {
            if (config.enableStatusMarking) { markSuperseded(old.id, newEntryId); superseded.add(old.id) }
            if (config.enableGraphSupersedes && !graphRepo.edgeExists(newEntryId, old.id, "SUPERSEDES")) {
                addSupersedesEdge(newEntryId, old.id, confidence, signal); edgesCreated++
            }
        }
        logResolution(superseded, edgesCreated, detection)
        return ResolutionResult(listOf(detection), conflicting.size, superseded, edgesCreated)
    }

    /** Post-search: filter entries that have been superseded. */
    fun filterSuperseded(results: List<KnowledgeSearchResult>): List<KnowledgeSearchResult> {
        if (!config.enableGraphSupersedes && !config.enableStatusMarking) return results
        val supersededIds = mutableSetOf<Long>()
        if (config.enableStatusMarking) {
            for (r in results) { if (getValidityStatus(r.entry.id) == "SUPERSEDED") supersededIds.add(r.entry.id) }
        }
        if (config.enableGraphSupersedes) {
            for (r in results) { if (r.entry.id !in supersededIds && hasActiveSupersedingEdge(r.entry.id)) supersededIds.add(r.entry.id) }
        }
        return results.filter { it.entry.id !in supersededIds }
    }

    /** Manually supersede an entry. */
    fun manualSupersede(oldId: Long, newId: Long, reason: String = "manual") {
        markSuperseded(oldId, newId)
        if (config.enableGraphSupersedes && !graphRepo.edgeExists(newId, oldId, "SUPERSEDES")) {
            addSupersedesEdge(newId, oldId, 1.0, reason)
        }
    }

    /** Undo supersession. */
    fun revalidate(entryId: Long) {
        conn.prepareStatement("UPDATE knowledge_entries SET validity_status='ACTIVE',superseded_by=NULL,superseded_at=NULL,updated_at=datetime('now') WHERE id=?")
            .use { it.setLong(1, entryId); it.executeUpdate() }
    }

    /** Get stats for diagnostics. */
    fun getStats(): ContradictionStats {
        val sup = countWhere("validity_status='SUPERSEDED'")
        val act = countWhere("validity_status='ACTIVE' OR validity_status IS NULL")
        val edg = countEdgesWhere("relation='SUPERSEDES'")
        return ContradictionStats(sup, act, edg)
    }

    private fun ensureSchema() {
        listOf(
            "ALTER TABLE knowledge_entries ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE'",
            "ALTER TABLE knowledge_entries ADD COLUMN superseded_by INTEGER DEFAULT NULL",
            "ALTER TABLE knowledge_entries ADD COLUMN superseded_at TEXT DEFAULT NULL"
        ).forEach { try { conn.createStatement().execute(it) } catch (_: Exception) {} }
        try { conn.createStatement().execute("CREATE INDEX IF NOT EXISTS idx_ke_validity ON knowledge_entries(validity_status)") } catch (_: Exception) {}
    }

    private fun getEntry(id: Long): EntrySnapshot? {
        val rs = conn.prepareStatement("SELECT id,content,summary,type,source,created_at FROM knowledge_entries WHERE id=?")
            .also { it.setLong(1, id) }.executeQuery()
        return if (rs.next()) EntrySnapshot(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)) else null
    }

    private fun findConflicting(entry: EntrySnapshot, excludeId: Long): List<EntrySnapshot> {
        val entities = extractEntities(excludeId)
        return if (entities.isNotEmpty()) findByEntities(entities, excludeId) else findBySimilar(entry, excludeId)
    }

    private fun extractEntities(entryId: Long): List<String> {
        val rs = conn.prepareStatement("SELECT entity_name FROM entity_index WHERE entry_id=?")
            .also { it.setLong(1, entryId) }.executeQuery()
        return generateSequence { if (rs.next()) rs.getString(1) else null }.toList()
    }

    private fun findByEntities(entities: List<String>, excludeId: Long): List<EntrySnapshot> {
        val seen = mutableSetOf<Long>(); val results = mutableListOf<EntrySnapshot>()
        for (e in entities) {
            val rs = conn.prepareStatement(
                "SELECT DISTINCT ke.id,ke.content,ke.summary,ke.type,ke.source,ke.created_at FROM knowledge_entries ke JOIN entity_index ei ON ke.id=ei.entry_id WHERE ei.entity_name=? AND ke.id!=? AND (ke.validity_status='ACTIVE' OR ke.validity_status IS NULL) AND ke.archived_at IS NULL LIMIT 20"
            ).also { it.setString(1, e); it.setLong(2, excludeId) }.executeQuery()
            while (rs.next()) { val id = rs.getLong(1); if (id !in seen) { seen.add(id); results.add(EntrySnapshot(id, rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6))) } }
        }
        return results
    }

    private fun findBySimilar(entry: EntrySnapshot, excludeId: Long): List<EntrySnapshot> {
        val q = entry.summary.replace(Regex("[^\\w\\s]"), " ").trim().take(60)
        if (q.isBlank()) return emptyList()
        return try {
            val rs = conn.prepareStatement("SELECT ke.id,ke.content,ke.summary,ke.type,ke.source,ke.created_at FROM knowledge_fts JOIN knowledge_entries ke ON knowledge_fts.rowid=ke.id WHERE knowledge_fts MATCH ? AND ke.id!=? AND (ke.validity_status='ACTIVE' OR ke.validity_status IS NULL) ORDER BY rank LIMIT 10")
                .also { it.setString(1, q); it.setLong(2, excludeId) }.executeQuery()
            generateSequence { if (rs.next()) EntrySnapshot(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)) else null }.toList()
        } catch (_: Exception) { emptyList() }
    }

    private fun computeConfidence(entry: EntrySnapshot, conflicting: List<EntrySnapshot>, signal: String): Double {
        var c = 0.5
        if (STRONG_SIGNALS.any { signal.contains(it) }) c += 0.2
        if (conflicting.all { it.createdAt < entry.createdAt }) c += 0.15
        if (conflicting.any { it.source != null && it.source == entry.source }) c += 0.1
        if (conflicting.any { it.type == entry.type }) c += 0.05
        return c.coerceAtMost(1.0)
    }

    private fun markSuperseded(oldId: Long, newId: Long) {
        conn.prepareStatement("UPDATE knowledge_entries SET validity_status='SUPERSEDED',superseded_by=?,superseded_at=datetime('now'),updated_at=datetime('now') WHERE id=?")
            .use { it.setLong(1, newId); it.setLong(2, oldId); it.executeUpdate() }
    }

    private fun addSupersedesEdge(src: Long, tgt: Long, weight: Double, signal: String) {
        conn.prepareStatement("INSERT INTO knowledge_graph_edges(source_id,target_id,relation,weight,metadata) VALUES(?,?,?,?,?)")
            .use { it.setLong(1, src); it.setLong(2, tgt); it.setString(3, "SUPERSEDES"); it.setDouble(4, weight); it.setString(5, """{"signal":"$signal"}"""); it.executeUpdate() }
    }

    private fun getValidityStatus(entryId: Long): String {
        val rs = conn.prepareStatement("SELECT validity_status FROM knowledge_entries WHERE id=?").also { it.setLong(1, entryId) }.executeQuery()
        return if (rs.next()) (rs.getString(1) ?: "ACTIVE") else "ACTIVE"
    }

    private fun hasActiveSupersedingEdge(targetId: Long): Boolean {
        val rs = conn.prepareStatement("SELECT source_id FROM knowledge_graph_edges WHERE target_id=? AND relation='SUPERSEDES'")
            .also { it.setLong(1, targetId) }.executeQuery()
        while (rs.next()) { if (getValidityStatus(rs.getLong(1)) != "SUPERSEDED") return true }
        return false
    }

    private fun countWhere(clause: String): Int = conn.createStatement().executeQuery("SELECT COUNT(*) FROM knowledge_entries WHERE $clause").let { if (it.next()) it.getInt(1) else 0 }
    private fun countEdgesWhere(clause: String): Int = conn.createStatement().executeQuery("SELECT COUNT(*) FROM knowledge_graph_edges WHERE $clause").let { if (it.next()) it.getInt(1) else 0 }

    private fun logResolution(superseded: List<Long>, edges: Int, d: ContradictionDetection) {
        try {
            val operation = if (superseded.isNotEmpty()) "CONTRADICTION_RESOLVED" else "CONTRADICTION_DETECTED"
            conn.prepareStatement("INSERT INTO memory_audit(operation,details,created_at) VALUES(?,?,datetime('now'))")
            .use { it.setString(1, operation); it.setString(2, """{"superseded":$superseded,"edges":$edges,"signal":"${d.signal}","confidence":${d.confidence},"conflicting":${d.conflictingEntryIds}}"""); it.executeUpdate() } } catch (_: Exception) {}
    }
}

private data class EntrySnapshot(val id: Long, val content: String, val summary: String, val type: String, val source: String?, val createdAt: String)
