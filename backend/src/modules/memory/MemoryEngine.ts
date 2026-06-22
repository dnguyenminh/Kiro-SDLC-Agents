/**
 * MemoryEngine — facade for the KB Memory system.
 * Single entry point for all memory operations in the backend.
 */

import Database from 'better-sqlite3';
import type {
  KnowledgeEntry, SearchResult, GraphEdge,
  TierStats, ConsolidationResult, ConversationTurn, ConversationSession,
} from './models.js';

export class MemoryEngine {
  private readonly db: Database.Database;
  private currentSessionId: string | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getDb(): Database.Database { return this.db; }
  getSessionId(): string | null { return this.currentSessionId; }

  // ─── Knowledge CRUD ───────────────────────────────────────────────

  insert(entry: Partial<KnowledgeEntry>): number {
    const stmt = this.db.prepare(`
      INSERT INTO knowledge_entries
      (content, summary, type, tier, source, source_ref, tags, confidence, agent_name, owner)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.content, entry.summary, entry.type,
      entry.tier ?? 'WORKING', entry.source ?? null,
      entry.source_ref ?? null, entry.tags ?? '',
      entry.confidence ?? 1.0, entry.agent_name ?? null,
      entry.owner ?? null,
    );
    return result.lastInsertRowid as number;
  }

  findById(id: number): KnowledgeEntry | undefined {
    return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?')
      .get(id) as KnowledgeEntry | undefined;
  }

  findFiltered(tier?: string, type?: string, limit = 20): KnowledgeEntry[] {
    const clauses: string[] = ['archived = 0'];
    const params: unknown[] = [];
    if (tier) { clauses.push('tier = ?'); params.push(tier); }
    if (type) { clauses.push('type = ?'); params.push(type); }
    const where = `WHERE ${clauses.join(' AND ')}`;
    params.push(limit);
    return this.db.prepare(
      `SELECT * FROM knowledge_entries ${where} ORDER BY created_at DESC LIMIT ?`
    ).all(...params) as KnowledgeEntry[];
  }

  deleteEntry(id: number): void {
    this.db.prepare('DELETE FROM knowledge_entries WHERE id = ?').run(id);
  }

  recordAccess(id: number): void {
    this.db.prepare(`
      UPDATE knowledge_entries
      SET access_count = access_count + 1, last_accessed_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  // ─── FTS Search ───────────────────────────────────────────────────

  search(query: string, limit = 10, tier?: string, type?: string): SearchResult[] {
    const ftsQuery = query.replace(/[^\w\s*":.]/g, ' ').trim() || '*';
    let sql: string;
    const params: unknown[] = [ftsQuery];
    if (tier && type) {
      sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.tier = ? AND ke.type = ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
      params.push(tier, type, limit);
    } else if (tier) {
      sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.tier = ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
      params.push(tier, limit);
    } else if (type) {
      sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.type = ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
      params.push(type, limit);
    } else {
      sql = `SELECT ke.*, rank FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.archived = 0
        ORDER BY rank LIMIT ?`;
      params.push(limit);
    }
    try {
      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map(row => {
        const { rank, ...entry } = row;
        return { entry: entry as KnowledgeEntry, score: -rank, matchType: 'fts' };
      });
    } catch { return []; }
  }

  // ─── Graph Operations ─────────────────────────────────────────────

  addEdge(sourceId: number, targetId: number, relation = 'RELATES_TO', weight = 1.0): number {
    const result = this.db.prepare(
      `INSERT INTO knowledge_graph_edges (source_id, target_id, relation, weight) VALUES (?, ?, ?, ?)`
    ).run(sourceId, targetId, relation, weight);
    return result.lastInsertRowid as number;
  }

  getNeighbors(nodeId: number): GraphEdge[] {
    return this.db.prepare(
      'SELECT * FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?'
    ).all(nodeId, nodeId) as GraphEdge[];
  }

  countEdges(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_graph_edges').get() as any).cnt;
  }

  // ─── Sessions ─────────────────────────────────────────────────────

  startSession(agentName?: string): string {
    const sid = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(
      `INSERT INTO memory_sessions (session_id, agent_name) VALUES (?, ?)`
    ).run(sid, agentName ?? null);
    this.currentSessionId = sid;
    this.auditLog('SESSION_START', undefined, sid);
    return sid;
  }

  endSession(): void {
    if (!this.currentSessionId) return;
    this.db.prepare(
      `UPDATE memory_sessions SET ended_at = datetime('now'), status = 'ended' WHERE session_id = ?`
    ).run(this.currentSessionId);
    this.auditLog('SESSION_END', undefined, this.currentSessionId);
    this.currentSessionId = null;
  }

  listSessions(limit = 20): any[] {
    return this.db.prepare(
      'SELECT * FROM memory_sessions ORDER BY started_at DESC LIMIT ?'
    ).all(limit) as any[];
  }

  // ─── Audit ────────────────────────────────────────────────────────

  auditLog(operation: string, entryId?: number, sessionId?: string): void {
    this.db.prepare(
      `INSERT INTO memory_audit (operation, entry_id, session_id) VALUES (?, ?, ?)`
    ).run(operation, entryId ?? null, sessionId ?? this.currentSessionId ?? null);
  }

  listAudit(limit = 20, operation?: string): any[] {
    if (operation) {
      return this.db.prepare(
        'SELECT * FROM memory_audit WHERE operation = ? ORDER BY created_at DESC LIMIT ?'
      ).all(operation, limit) as any[];
    }
    return this.db.prepare(
      'SELECT * FROM memory_audit ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as any[];
  }
}
