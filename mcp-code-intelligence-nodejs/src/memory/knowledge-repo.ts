/**
 * KnowledgeRepository — CRUD operations for knowledge entries.
 */

import Database from 'better-sqlite3';
import { KnowledgeEntry } from './models.js';

export class KnowledgeRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Insert a new knowledge entry, returns generated ID. */
  insert(entry: Partial<KnowledgeEntry>): number {
    const stmt = this.db.prepare(`
      INSERT INTO knowledge_entries
      (content, summary, type, tier, source, source_ref, tags, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.content, entry.summary, entry.type,
      entry.tier ?? 'WORKING', entry.source ?? null,
      entry.source_ref ?? null, entry.tags ?? '',
      entry.confidence ?? 1.0
    );
    return result.lastInsertRowid as number;
  }

  /** Find entry by ID. */
  findById(id: number): KnowledgeEntry | undefined {
    return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?')
      .get(id) as KnowledgeEntry | undefined;
  }

  /** Find entries by tier. */
  findByTier(tier: string, limit = 100): KnowledgeEntry[] {
    return this.db.prepare(
      'SELECT * FROM knowledge_entries WHERE tier = ? ORDER BY updated_at DESC LIMIT ?'
    ).all(tier, limit) as KnowledgeEntry[];
  }

  /** Find entries by type. */
  findByType(type: string, limit = 100): KnowledgeEntry[] {
    return this.db.prepare(
      'SELECT * FROM knowledge_entries WHERE type = ? ORDER BY updated_at DESC LIMIT ?'
    ).all(type, limit) as KnowledgeEntry[];
  }

  /** Find entries with flexible filters, sorting, and pagination. */
  findFiltered(
    tier?: string, type?: string, limit = 20, offset = 0, sort = 'created_at', afterId?: number
  ): KnowledgeEntry[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (tier) { clauses.push('tier = ?'); params.push(tier); }
    if (type) { clauses.push('type = ?'); params.push(type); }
    if (afterId !== undefined) { clauses.push('id > ?'); params.push(afterId); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderCol = sort === 'access_count' ? 'access_count DESC'
      : sort === 'confidence' ? 'confidence DESC' : 'created_at DESC';
    const sql = `SELECT * FROM knowledge_entries ${where} ORDER BY ${orderCol} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    return this.db.prepare(sql).all(...params) as KnowledgeEntry[];
  }

  /** Update tier for an entry. */
  updateTier(id: number, newTier: string): void {
    this.db.prepare(
      "UPDATE knowledge_entries SET tier = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newTier, id);
  }

  /** Increment access count and update last_accessed_at. */
  recordAccess(id: number): void {
    this.db.prepare(`
      UPDATE knowledge_entries
      SET access_count = access_count + 1, last_accessed_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /** Delete entry by ID. */
  delete(id: number): void {
    this.db.prepare('DELETE FROM knowledge_entries WHERE id = ?').run(id);
  }
}
