"use strict";
/**
 * KnowledgeRepository — CRUD operations for knowledge entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeRepository = void 0;
class KnowledgeRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Insert a new knowledge entry, returns generated ID. */
    insert(entry) {
        const stmt = this.db.prepare(`
      INSERT INTO knowledge_entries
      (content, summary, type, tier, source, source_ref, tags, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(entry.content, entry.summary, entry.type, entry.tier ?? 'WORKING', entry.source ?? null, entry.source_ref ?? null, entry.tags ?? '', entry.confidence ?? 1.0);
        return result.lastInsertRowid;
    }
    /** Find entry by ID. */
    findById(id) {
        return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?')
            .get(id);
    }
    /** Find entries by tier. */
    findByTier(tier, limit = 100) {
        return this.db.prepare('SELECT * FROM knowledge_entries WHERE tier = ? ORDER BY updated_at DESC LIMIT ?').all(tier, limit);
    }
    /** Find entries by type. */
    findByType(type, limit = 100) {
        return this.db.prepare('SELECT * FROM knowledge_entries WHERE type = ? ORDER BY updated_at DESC LIMIT ?').all(type, limit);
    }
    /** Find entries with flexible filters, sorting, and pagination. */
    findFiltered(tier, type, limit = 20, offset = 0, sort = 'created_at', afterId) {
        const clauses = [];
        const params = [];
        if (tier) {
            clauses.push('tier = ?');
            params.push(tier);
        }
        if (type) {
            clauses.push('type = ?');
            params.push(type);
        }
        if (afterId !== undefined) {
            clauses.push('id > ?');
            params.push(afterId);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const orderCol = sort === 'access_count' ? 'access_count DESC'
            : sort === 'confidence' ? 'confidence DESC' : 'created_at DESC';
        const sql = `SELECT * FROM knowledge_entries ${where} ORDER BY ${orderCol} LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        return this.db.prepare(sql).all(...params);
    }
    /** Update tier for an entry. */
    updateTier(id, newTier) {
        this.db.prepare("UPDATE knowledge_entries SET tier = ?, updated_at = datetime('now') WHERE id = ?").run(newTier, id);
    }
    /** Increment access count and update last_accessed_at. */
    recordAccess(id) {
        this.db.prepare(`
      UPDATE knowledge_entries
      SET access_count = access_count + 1, last_accessed_at = datetime('now')
      WHERE id = ?
    `).run(id);
    }
    /** Delete entry by ID. */
    delete(id) {
        this.db.prepare('DELETE FROM knowledge_entries WHERE id = ?').run(id);
    }
    /** Update structured_map JSON for an entry. */
    updateStructuredMap(id, mapJson) {
        this.db.prepare("UPDATE knowledge_entries SET structured_map = ?, updated_at = datetime('now') WHERE id = ?").run(mapJson, id);
    }
    /** Update quality_score for an entry. */
    updateQualityScore(id, score) {
        this.db.prepare("UPDATE knowledge_entries SET quality_score = ?, updated_at = datetime('now') WHERE id = ?").run(score, id);
    }
    /** Get structured_map for an entry. */
    getStructuredMap(id) {
        const row = this.db.prepare('SELECT structured_map FROM knowledge_entries WHERE id = ?').get(id);
        return row?.structured_map ?? '{}';
    }
}
exports.KnowledgeRepository = KnowledgeRepository;
//# sourceMappingURL=knowledge-repo.js.map