/**
 * MemoryEngine — facade for the KB Memory system.
 * Single entry point for all memory operations in the backend.
 */
export class MemoryEngine {
    db;
    currentSessionId = null;
    constructor(db) {
        this.db = db;
    }
    getDb() { return this.db; }
    getSessionId() { return this.currentSessionId; }
    // ─── Knowledge CRUD ───────────────────────────────────────────────
    insert(entry) {
        const stmt = this.db.prepare(`
      INSERT INTO knowledge_entries
      (content, summary, type, tier, source, source_ref, tags, confidence, agent_name, owner)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(entry.content, entry.summary, entry.type, entry.tier ?? 'WORKING', entry.source ?? null, entry.source_ref ?? null, entry.tags ?? '', entry.confidence ?? 1.0, entry.agent_name ?? null, entry.owner ?? null);
        return result.lastInsertRowid;
    }
    findById(id) {
        return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?')
            .get(id);
    }
    findFiltered(tier, type, limit = 20) {
        const clauses = ['archived = 0'];
        const params = [];
        if (tier) {
            clauses.push('tier = ?');
            params.push(tier);
        }
        if (type) {
            clauses.push('type = ?');
            params.push(type);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        params.push(limit);
        return this.db.prepare(`SELECT * FROM knowledge_entries ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
    }
    deleteEntry(id) {
        this.db.prepare('DELETE FROM knowledge_entries WHERE id = ?').run(id);
    }
    recordAccess(id) {
        this.db.prepare(`
      UPDATE knowledge_entries
      SET access_count = access_count + 1, last_accessed_at = datetime('now')
      WHERE id = ?
    `).run(id);
    }
    // ─── FTS Search ───────────────────────────────────────────────────
    search(query, limit = 10, tier, type) {
        const ftsQuery = query.replace(/[^\w\s*":.]/g, ' ').trim() || '*';
        let sql;
        const params = [ftsQuery];
        if (tier && type) {
            sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.tier = ? AND ke.type = ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
            params.push(tier, type, limit);
        }
        else if (tier) {
            sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.tier = ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
            params.push(tier, limit);
        }
        else if (type) {
            sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.type = ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
            params.push(type, limit);
        }
        else {
            sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
            params.push(limit);
        }
        try {
            const rows = this.db.prepare(sql).all(...params);
            return rows.map(row => {
                const { rank, ...entry } = row;
                return { entry: entry, score: -rank, matchType: 'fts' };
            });
        }
        catch {
            return [];
        }
    }
    // ─── Graph Operations ─────────────────────────────────────────────
    addEdge(sourceId, targetId, relation = 'RELATES_TO', weight = 1.0) {
        const result = this.db.prepare(`INSERT INTO knowledge_graph_edges (source_id, target_id, relation, weight) VALUES (?, ?, ?, ?)`).run(sourceId, targetId, relation, weight);
        return result.lastInsertRowid;
    }
    getNeighbors(nodeId) {
        return this.db.prepare('SELECT * FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?').all(nodeId, nodeId);
    }
    countEdges() {
        return this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_graph_edges').get().cnt;
    }
    // ─── Sessions ─────────────────────────────────────────────────────
    startSession(agentName) {
        const sid = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.db.prepare(`INSERT INTO memory_sessions (session_id, agent_name) VALUES (?, ?)`).run(sid, agentName ?? null);
        this.currentSessionId = sid;
        this.auditLog('SESSION_START', undefined, sid);
        return sid;
    }
    endSession() {
        if (!this.currentSessionId)
            return;
        this.db.prepare(`UPDATE memory_sessions SET ended_at = datetime('now'), status = 'ended' WHERE session_id = ?`).run(this.currentSessionId);
        this.auditLog('SESSION_END', undefined, this.currentSessionId);
        this.currentSessionId = null;
    }
    listSessions(limit = 20) {
        return this.db.prepare('SELECT * FROM memory_sessions ORDER BY started_at DESC LIMIT ?').all(limit);
    }
    // ─── Audit ────────────────────────────────────────────────────────
    auditLog(operation, entryId, sessionId) {
        this.db.prepare(`INSERT INTO memory_audit (operation, entry_id, session_id) VALUES (?, ?, ?)`).run(operation, entryId ?? null, sessionId ?? this.currentSessionId ?? null);
    }
    listAudit(limit = 20, operation) {
        if (operation) {
            return this.db.prepare('SELECT * FROM memory_audit WHERE operation = ? ORDER BY created_at DESC LIMIT ?').all(operation, limit);
        }
        return this.db.prepare('SELECT * FROM memory_audit ORDER BY created_at DESC LIMIT ?').all(limit);
    }
}
//# sourceMappingURL=MemoryEngine.js.map