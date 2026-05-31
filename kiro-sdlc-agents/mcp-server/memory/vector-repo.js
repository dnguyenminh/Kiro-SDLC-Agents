"use strict";
/**
 * VectorRepository — CRUD for knowledge entry embeddings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorRepository = void 0;
class VectorRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Store or update embedding vector for an entry. */
    upsert(entryId, vector, model, dimensions) {
        this.db.prepare(`
      INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        vector = excluded.vector,
        model = excluded.model,
        dimensions = excluded.dimensions,
        created_at = datetime('now')
    `).run(entryId, vector, model, dimensions);
    }
    /** Get all vectors (for brute-force similarity). */
    findAll() {
        return this.db.prepare('SELECT * FROM knowledge_vectors').all();
    }
    /** Get vector for a specific entry (as float32 array). KSA-190. */
    getVector(entryId) {
        const row = this.db.prepare('SELECT vector, dimensions FROM knowledge_vectors WHERE entry_id = ?').get(entryId);
        if (!row)
            return null;
        const floats = [];
        for (let i = 0; i < row.vector.length; i += 4) {
            floats.push(row.vector.readFloatLE(i));
        }
        return floats;
    }
    /** Count total vectors stored. */
    count() {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_vectors').get();
        return row.cnt;
    }
}
exports.VectorRepository = VectorRepository;
//# sourceMappingURL=vector-repo.js.map