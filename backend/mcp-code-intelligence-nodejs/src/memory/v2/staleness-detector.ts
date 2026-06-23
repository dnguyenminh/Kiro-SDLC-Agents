/**
 * KSA-70: Staleness Detection & Auto-Archive + Review management.
 */

import type Database from 'better-sqlite3';

const STALE_DAYS = 180;
const WEIGHTS = { access: 0.4, update: 0.3, review: 0.3 };

export class StalenessDetector {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'detect';
    const threshold = (args.threshold as number) ?? 0.8;

    if (action === 'unarchive') {
      const entryId = args.entry_id as number;
      if (!entryId) return 'Error: entry_id required for unarchive';
      return JSON.stringify(this.unarchive(entryId));
    }
    if (action === 'archive') {
      const dryRun = (args.dry_run as boolean) ?? false;
      return JSON.stringify(this.autoArchive(threshold, dryRun), null, 2);
    }
    return JSON.stringify(this.detectStale(threshold), null, 2);
  }

  executeDueReviews(args: Record<string, unknown>): string {
    const days = (args.days as number) ?? 90;
    const limit = (args.limit as number) ?? 20;
    const entries = this.getDueReviews(days, limit);
    if (!entries.length) return 'No entries due for review.';
    const lines = [`Entries due for review (${entries.length}):\n`];
    for (const e of entries) {
      lines.push(`#${e.id} [${e.type}] ${(e.summary ?? '').slice(0, 60)}`);
      lines.push(`  Owner: ${e.owner ?? 'unassigned'} | Last reviewed: ${e.last_reviewed_at ?? 'never'}`);
    }
    return lines.join('\n');
  }

  executeReview(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'mark_reviewed';
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';

    if (action === 'mark_reviewed') return JSON.stringify(this.markReviewed(entryId, args.reviewer as string));
    if (action === 'assign_owner') return JSON.stringify(this.assignField(entryId, 'owner', args.owner as string));
    if (action === 'assign_reviewer') return JSON.stringify(this.assignField(entryId, 'reviewer', args.reviewer as string));
    if (action === 'set_status') return JSON.stringify(this.setStatus(entryId, args.status as string));
    return `Unknown action: ${action}`;
  }

  private detectStale(threshold: number): object {
    this.recomputeStaleness();
    const rows = this.db.prepare(
      'SELECT id, summary, type, tier, staleness_score, owner FROM knowledge_entries WHERE staleness_score >= ? AND archived_at IS NULL ORDER BY staleness_score DESC LIMIT 50'
    ).all(threshold) as any[];
    return { stale_count: rows.length, entries: rows };
  }

  private autoArchive(threshold: number, dryRun: boolean): object {
    this.recomputeStaleness();
    const rows = this.db.prepare(
      'SELECT id, summary, staleness_score FROM knowledge_entries WHERE staleness_score >= ? AND archived_at IS NULL ORDER BY staleness_score DESC'
    ).all(threshold) as any[];
    if (!dryRun) {
      for (const r of rows) this.archiveEntry(r.id, 'auto:staleness_exceeded');
    }
    return { archived_count: rows.length, entries: rows.map((r: any) => ({ id: r.id, summary: r.summary?.slice(0, 80), staleness: r.staleness_score })), threshold, dry_run: dryRun };
  }

  private unarchive(entryId: number): object {
    this.db.prepare("UPDATE knowledge_entries SET archived_at = NULL, staleness_score = 0.0, updated_at = datetime('now') WHERE id = ?").run(entryId);
    return { entry_id: entryId, status: 'unarchived' };
  }

  private getDueReviews(days: number, limit: number): any[] {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    return this.db.prepare(
      'SELECT id, summary, type, tier, owner, reviewer, last_reviewed_at FROM knowledge_entries WHERE archived_at IS NULL AND (last_reviewed_at IS NULL OR last_reviewed_at < ?) ORDER BY last_reviewed_at ASC LIMIT ?'
    ).all(cutoff, limit) as any[];
  }

  private markReviewed(entryId: number, reviewer?: string): object {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE knowledge_entries SET last_reviewed_at = ?, staleness_score = 0.0, updated_at = datetime('now') WHERE id = ?").run(now, entryId);
    return { entry_id: entryId, reviewed_at: now, reviewer: reviewer ?? null };
  }

  private assignField(entryId: number, field: string, value?: string): object {
    this.db.prepare(`UPDATE knowledge_entries SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).run(value ?? '', entryId);
    return { entry_id: entryId, [field]: value ?? '' };
  }

  private setStatus(entryId: number, status?: string): object {
    const s = status ?? 'pending';
    this.db.prepare("UPDATE knowledge_entries SET review_status = ?, updated_at = datetime('now') WHERE id = ?").run(s, entryId);
    return { entry_id: entryId, review_status: s };
  }

  private recomputeStaleness(): void {
    const now = Date.now();
    const rows = this.db.prepare('SELECT id, last_accessed_at, updated_at, last_reviewed_at FROM knowledge_entries WHERE archived_at IS NULL').all() as any[];
    const stmt = this.db.prepare('UPDATE knowledge_entries SET staleness_score = ? WHERE id = ?');
    const tx = this.db.transaction(() => {
      for (const row of rows) stmt.run(this.computeScore(row, now), row.id);
    });
    tx();
  }

  private computeScore(row: any, now: number): number {
    const daysSince = (dt: string | null) => {
      if (!dt) return STALE_DAYS;
      return Math.min((now - new Date(dt).getTime()) / 86400000, STALE_DAYS);
    };
    const normAccess = daysSince(row.last_accessed_at) / STALE_DAYS;
    const normUpdate = daysSince(row.updated_at) / STALE_DAYS;
    const normReview = daysSince(row.last_reviewed_at) / STALE_DAYS;
    return Math.min(WEIGHTS.access * normAccess + WEIGHTS.update * normUpdate + WEIGHTS.review * normReview, 1.0);
  }

  private archiveEntry(entryId: number, reason: string): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE knowledge_entries SET archived_at = ? WHERE id = ?').run(now, entryId);
    this.db.prepare('INSERT INTO archive_log (entry_id, reason, auto_archived) VALUES (?, ?, 1)').run(entryId, reason);
  }
}
