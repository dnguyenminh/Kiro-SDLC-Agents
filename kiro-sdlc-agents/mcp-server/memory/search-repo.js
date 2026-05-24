"use strict";
/**
 * KnowledgeSearchRepository — FTS5 full-text search for knowledge entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeSearchRepository = void 0;
class KnowledgeSearchRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Full-text search using FTS5. */
    search(query, limit = 20) {
        const ftsQuery = this.sanitizeQuery(query);
        const rows = this.db.prepare(`
      SELECT ke.*, rank
      FROM knowledge_fts
      JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
      WHERE knowledge_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit);
        return rows.map(row => ({
            entry: this.stripRank(row),
            score: -row.rank,
            matchType: 'fts',
        }));
    }
    /** Search within a specific tier. */
    searchInTier(query, tier, limit = 20) {
        const ftsQuery = this.sanitizeQuery(query);
        const rows = this.db.prepare(`
      SELECT ke.*, rank
      FROM knowledge_fts
      JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
      WHERE knowledge_fts MATCH ? AND ke.tier = ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, tier, limit);
        return rows.map(row => ({
            entry: this.stripRank(row),
            score: -row.rank,
            matchType: 'fts',
        }));
    }
    sanitizeQuery(query) {
        const cleaned = query.replace(/[^\w\s*":.]/g, ' ').trim();
        return cleaned || '*';
    }
    stripRank(row) {
        const { rank, ...entry } = row;
        return entry;
    }
}
exports.KnowledgeSearchRepository = KnowledgeSearchRepository;
//# sourceMappingURL=search-repo.js.map