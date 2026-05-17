/**
 * GraphRepository — CRUD for knowledge graph edges (SQLite persistence).
 */

import Database from 'better-sqlite3';
import { GraphEdge } from './models.js';

export class GraphRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Add an edge between two knowledge entries. */
  addEdge(edge: Partial<GraphEdge>): number {
    const result = this.db.prepare(`
      INSERT INTO knowledge_graph_edges (source_id, target_id, relation, weight, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      edge.source_id, edge.target_id,
      edge.relation ?? 'RELATES_TO',
      edge.weight ?? 1.0, edge.metadata ?? null
    );
    return result.lastInsertRowid as number;
  }

  /** Get all edges for a node (both directions). */
  getConnected(entryId: number): GraphEdge[] {
    return this.db.prepare(
      'SELECT * FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?'
    ).all(entryId, entryId) as GraphEdge[];
  }

  /** Get all edges (for loading graph into memory). */
  findAll(limit = 10000): GraphEdge[] {
    return this.db.prepare(
      'SELECT * FROM knowledge_graph_edges LIMIT ?'
    ).all(limit) as GraphEdge[];
  }

  /** Remove an edge by ID. */
  removeEdge(id: number): void {
    this.db.prepare('DELETE FROM knowledge_graph_edges WHERE id = ?').run(id);
  }

  /** Count total edges. */
  countEdges(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM knowledge_graph_edges'
    ).get() as { cnt: number };
    return row.cnt;
  }
}
