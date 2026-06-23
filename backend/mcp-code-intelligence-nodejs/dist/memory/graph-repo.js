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
    /** Check if edge exists (direction-agnostic). KSA-190. */
    edgeExists(sourceId, targetId, relation) {
        const row = this.db.prepare(`
      SELECT 1 FROM knowledge_graph_edges
      WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))
      AND relation = ?
      LIMIT 1
    `).get(sourceId, targetId, targetId, sourceId, relation);
        return row !== undefined;
    }
    /** Find entries with 0 edges (orphans). KSA-190. */
    findOrphans(limit = 50) {
        const rows = this.db.prepare(`
      SELECT ke.id FROM knowledge_entries ke
      WHERE ke.archived = 0
      AND ke.id NOT IN (
        SELECT source_id FROM knowledge_graph_edges
        UNION
        SELECT target_id FROM knowledge_graph_edges
      )
      LIMIT ?
    `).all(limit);
        return rows.map(r => r.id);
    }
}
exports.GraphRepository = GraphRepository;
//# sourceMappingURL=graph-repo.js.map