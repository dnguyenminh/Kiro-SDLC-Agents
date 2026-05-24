"use strict";
/**
 * GraphRepository — CRUD for knowledge graph edges (SQLite persistence).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRepository = void 0;
class GraphRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Add an edge between two knowledge entries. */
    addEdge(edge) {
        const result = this.db.prepare(`
      INSERT INTO knowledge_graph_edges (source_id, target_id, relation, weight, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(edge.source_id, edge.target_id, edge.relation ?? 'RELATES_TO', edge.weight ?? 1.0, edge.metadata ?? null);
        return result.lastInsertRowid;
    }
    /** Get all edges for a node (both directions). */
    getConnected(entryId) {
        return this.db.prepare('SELECT * FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?').all(entryId, entryId);
    }
    /** Get all edges (for loading graph into memory). */
    findAll(limit = 10000) {
        return this.db.prepare('SELECT * FROM knowledge_graph_edges LIMIT ?').all(limit);
    }
    /** Remove an edge by ID. */
    removeEdge(id) {
        this.db.prepare('DELETE FROM knowledge_graph_edges WHERE id = ?').run(id);
    }
    /** Count total edges. */
    countEdges() {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_graph_edges').get();
        return row.cnt;
    }
}
exports.GraphRepository = GraphRepository;
//# sourceMappingURL=graph-repo.js.map