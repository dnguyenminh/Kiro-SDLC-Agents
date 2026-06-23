/**
 * WorkingTierExpiry — lazy auto-expiry of stale WORKING tier entries.
 * Runs on every mem_search call (no background threads).
 * Entries older than expiryHours are promoted (quality ≥ 60) or archived.
 * Pinned entries are exempt from expiry (BR-F1-05).
 */

import Database from 'better-sqlite3';

export interface ExpiryAction {
  entry_id: number;
  action: 'promoted' | 'archived';
  quality_score: number;
  to_tier?: string;
}

interface StaleEntry {
  id: number;
  quality_score: number | null;
}

export class WorkingTierExpiry {
  private readonly db: Database.Database;
  private readonly expiryHours: number;
  private readonly promoteThreshold: number;

  constructor(
    db: Database.Database,
    options?: { expiryHours?: number; promoteThreshold?: number }
  ) {
    this.db = db;
    this.expiryHours = options?.expiryHours ?? 24;
    this.promoteThreshold = options?.promoteThreshold ?? 60;
  }

  /** Process stale WORKING entries. Returns actions taken. */
  processStale(): ExpiryAction[] {
    const stale = this.getStaleEntries();
    if (stale.length === 0) return [];

    const actions: ExpiryAction[] = [];
    const promoteStmt = this.db.prepare(
      `UPDATE knowledge_entries SET tier = 'EPISODIC', updated_at = datetime('now')
       WHERE id = ?`
    );
    const archiveStmt = this.db.prepare(
      `UPDATE knowledge_entries SET archived = 1, updated_at = datetime('now')
       WHERE id = ?`
    );

    const tx = this.db.transaction(() => {
      for (const entry of stale) {
        const score = entry.quality_score ?? 0;
        if (score >= this.promoteThreshold) {
          promoteStmt.run(entry.id);
          actions.push({
            entry_id: entry.id,
            action: 'promoted',
            quality_score: score,
            to_tier: 'EPISODIC',
          });
        } else {
          archiveStmt.run(entry.id);
          actions.push({
            entry_id: entry.id,
            action: 'archived',
            quality_score: score,
          });
        }
      }
    });
    tx();

    return actions;
  }

  /** Find WORKING entries older than expiryHours, excluding pinned. */
  private getStaleEntries(): StaleEntry[] {
    const cutoff = new Date(Date.now() - this.expiryHours * 3600_000).toISOString();
    return this.db.prepare(`
      SELECT id, quality_score FROM knowledge_entries
      WHERE tier = 'WORKING'
        AND archived = 0
        AND pinned = 0
        AND created_at < ?
      ORDER BY created_at ASC
      LIMIT 100
    `).all(cutoff) as StaleEntry[];
  }
}
