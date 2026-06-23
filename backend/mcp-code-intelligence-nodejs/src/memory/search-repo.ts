/**
 * KnowledgeSearchRepository — FTS5 full-text search for knowledge entries.
 */

import Database from 'better-sqlite3';
import { KnowledgeEntry, SearchResult } from './models.js';

export class KnowledgeSearchRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Full-text search using FTS5. */
  search(query: string, limit = 20): SearchResult[] {
    const ftsQuery = this.sanitizeQuery(query);
    const rows = this.db.prepare(`
      SELECT ke.*, rank
      FROM knowledge_fts
      JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
      WHERE knowledge_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit) as (KnowledgeEntry & { rank: number })[];

    return rows.map(row => ({
      entry: this.stripRank(row),
      score: -row.rank,
      matchType: 'fts',
    }));
  }

  /** Search within a specific tier. */
  searchInTier(query: string, tier: string, limit = 20): SearchResult[] {
    const ftsQuery = this.sanitizeQuery(query);
    const rows = this.db.prepare(`
      SELECT ke.*, rank
      FROM knowledge_fts
      JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
      WHERE knowledge_fts MATCH ? AND ke.tier = ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, tier, limit) as (KnowledgeEntry & { rank: number })[];

    return rows.map(row => ({
      entry: this.stripRank(row),
      score: -row.rank,
      matchType: 'fts',
    }));
  }

  private sanitizeQuery(query: string): string {
    const cleaned = query.replace(/[^\w\s*":.]/g, ' ').trim();
    return cleaned || '*';
  }

  private stripRank(row: KnowledgeEntry & { rank: number }): KnowledgeEntry {
    const { rank, ...entry } = row;
    return entry;
  }
}
