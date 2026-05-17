/**
 * ConsolidationRepository — tier transition logging and statistics.
 */

import Database from 'better-sqlite3';
import { TierStats } from './models.js';

export class ConsolidationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Log a tier transition. */
  logTransition(entryId: number, fromTier: string, toTier: string, reason: string): void {
    this.db.prepare(`
      INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason)
      VALUES (?, ?, ?, ?)
    `).run(entryId, fromTier, toTier, reason);
  }

  /** Get tier statistics (entry count, avg confidence, avg access). */
  getTierStats(): TierStats[] {
    return this.db.prepare(`
      SELECT tier, COUNT(*) as entryCount,
             AVG(confidence) as avgConfidence,
             AVG(access_count) as avgAccessCount
      FROM knowledge_entries
      GROUP BY tier
    `).all() as TierStats[];
  }

  /** Find entries eligible for promotion. */
  findPromotionCandidates(tier: string, minAccess: number, minConfidence: number): number[] {
    const rows = this.db.prepare(`
      SELECT id FROM knowledge_entries
      WHERE tier = ? AND access_count >= ? AND confidence >= ?
      ORDER BY access_count DESC
    `).all(tier, minAccess, minConfidence) as { id: number }[];
    return rows.map(r => r.id);
  }
}
