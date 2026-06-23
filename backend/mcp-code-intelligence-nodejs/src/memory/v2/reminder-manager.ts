/**
 * KSA-72: Scheduled Review Reminders.
 */

import type Database from 'better-sqlite3';

export class ReminderManager {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'due';

    switch (action) {
      case 'schedule': return this.schedule(args);
      case 'snooze': return this.snooze(args);
      case 'dismiss': return this.dismiss(args);
      case 'complete': return this.complete(args);
      case 'auto_schedule': return JSON.stringify(this.autoScheduleAll());
      case 'stats': return JSON.stringify(this.getStats());
      default: return this.getDue(args);
    }
  }

  private schedule(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    const interval = (args.interval_days as number) ?? 90;
    const assignee = args.assignee as string ?? null;
    const nextAt = new Date(Date.now() + interval * 86400000).toISOString();
    this.db.prepare(
      'INSERT OR REPLACE INTO review_reminders (entry_id, interval_days, next_reminder_at, assignee) VALUES (?, ?, ?, ?)'
    ).run(entryId, interval, nextAt, assignee);
    return JSON.stringify({ entry_id: entryId, interval_days: interval, next_reminder_at: nextAt, assignee });
  }

  private snooze(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    const days = (args.snooze_days as number) ?? 7;
    const nextAt = new Date(Date.now() + days * 86400000).toISOString();
    this.db.prepare(
      'UPDATE review_reminders SET next_reminder_at = ?, snooze_count = snooze_count + 1 WHERE entry_id = ?'
    ).run(nextAt, entryId);
    return JSON.stringify({ entry_id: entryId, snoozed_until: nextAt });
  }

  private dismiss(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    this.db.prepare('UPDATE review_reminders SET is_active = 0 WHERE entry_id = ?').run(entryId);
    return JSON.stringify({ entry_id: entryId, status: 'dismissed' });
  }

  private complete(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    const now = new Date().toISOString();
    const row = this.db.prepare('SELECT interval_days FROM review_reminders WHERE entry_id = ?').get(entryId) as any;
    const interval = row?.interval_days ?? 90;
    const nextAt = new Date(Date.now() + interval * 86400000).toISOString();
    this.db.prepare('UPDATE review_reminders SET last_reviewed_at = ?, next_reminder_at = ?, snooze_count = 0 WHERE entry_id = ?').run(now, nextAt, entryId);
    this.db.prepare("UPDATE knowledge_entries SET last_reviewed_at = ?, staleness_score = 0.0 WHERE id = ?").run(now, entryId);
    return JSON.stringify({ entry_id: entryId, reviewed_at: now, next_reminder_at: nextAt });
  }

  private autoScheduleAll(): object {
    const rows = this.db.prepare(
      'SELECT id FROM knowledge_entries WHERE archived_at IS NULL AND id NOT IN (SELECT entry_id FROM review_reminders)'
    ).all() as any[];
    let scheduled = 0;
    for (const row of rows) {
      const nextAt = new Date(Date.now() + 90 * 86400000).toISOString();
      this.db.prepare('INSERT OR IGNORE INTO review_reminders (entry_id, interval_days, next_reminder_at) VALUES (?, 90, ?)').run(row.id, nextAt);
      scheduled++;
    }
    return { scheduled, total_entries: rows.length };
  }

  private getStats(): object {
    const total = this.db.prepare('SELECT COUNT(*) as cnt FROM review_reminders WHERE is_active = 1').get() as any;
    const due = this.db.prepare("SELECT COUNT(*) as cnt FROM review_reminders WHERE is_active = 1 AND next_reminder_at <= datetime('now')").get() as any;
    const snoozed = this.db.prepare('SELECT COUNT(*) as cnt FROM review_reminders WHERE snooze_count > 0 AND is_active = 1').get() as any;
    return { total_active: total.cnt, due_now: due.cnt, snoozed: snoozed.cnt };
  }

  private getDue(args: Record<string, unknown>): string {
    const limit = (args.limit as number) ?? 20;
    const rows = this.db.prepare(
      "SELECT rr.entry_id, rr.next_reminder_at, rr.assignee, rr.snooze_count, ke.summary, ke.type FROM review_reminders rr JOIN knowledge_entries ke ON rr.entry_id = ke.id WHERE rr.is_active = 1 AND rr.next_reminder_at <= datetime('now') ORDER BY rr.next_reminder_at ASC LIMIT ?"
    ).all(limit) as any[];
    if (!rows.length) return 'No reminders due.';
    const lines = [`Due reminders (${rows.length}):\n`];
    for (const r of rows) {
      lines.push(`#${r.entry_id} [${r.type}] ${(r.summary ?? '').slice(0, 60)}`);
      lines.push(`  Due: ${r.next_reminder_at} | Assignee: ${r.assignee ?? 'unassigned'}`);
    }
    return lines.join('\n');
  }
}
