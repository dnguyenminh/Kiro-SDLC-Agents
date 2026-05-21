/**
 * KSA-81: Feedback Loop (Thumbs Up/Down).
 */

import type Database from 'better-sqlite3';

export class FeedbackManager {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'summary';

    switch (action) {
      case 'submit': return this.submitFeedback(args);
      case 'low_rated': return JSON.stringify(this.getLowRated(args), null, 2);
      case 'top_rated': return JSON.stringify(this.getTopRated(args), null, 2);
      default: return this.getSummary(args);
    }
  }

  private submitFeedback(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    const rating = args.rating as number;
    if (!entryId || rating === undefined) return 'Error: entry_id and rating required';
    if (rating !== 1 && rating !== -1) return 'Error: rating must be 1 or -1';
    const comment = args.comment as string ?? null;
    this.db.prepare('INSERT INTO entry_feedback (entry_id, rating, comment) VALUES (?, ?, ?)').run(entryId, rating, comment);
    this.updateFeedbackScore(entryId);
    return JSON.stringify({ entry_id: entryId, rating, status: 'recorded' });
  }

  private getSummary(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required for summary';
    const row = this.db.prepare(
      'SELECT COUNT(*) as total, SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as positive, SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as negative FROM entry_feedback WHERE entry_id = ?'
    ).get(entryId) as any;
    return JSON.stringify({ entry_id: entryId, total: row.total, positive: row.positive ?? 0, negative: row.negative ?? 0, score: (row.positive ?? 0) - (row.negative ?? 0) });
  }

  private getLowRated(args: Record<string, unknown>): object[] {
    const limit = (args.limit as number) ?? 10;
    return this.db.prepare(
      'SELECT ke.id, ke.summary, ke.type, ke.feedback_score FROM knowledge_entries ke WHERE ke.feedback_score < 0 AND ke.archived_at IS NULL ORDER BY ke.feedback_score ASC LIMIT ?'
    ).all(limit) as object[];
  }

  private getTopRated(args: Record<string, unknown>): object[] {
    const limit = (args.limit as number) ?? 10;
    return this.db.prepare(
      'SELECT ke.id, ke.summary, ke.type, ke.feedback_score FROM knowledge_entries ke WHERE ke.feedback_score > 0 AND ke.archived_at IS NULL ORDER BY ke.feedback_score DESC LIMIT ?'
    ).all(limit) as object[];
  }

  private updateFeedbackScore(entryId: number): void {
    const row = this.db.prepare('SELECT SUM(rating) as score FROM entry_feedback WHERE entry_id = ?').get(entryId) as any;
    this.db.prepare('UPDATE knowledge_entries SET feedback_score = ? WHERE id = ?').run(row.score ?? 0, entryId);
  }
}
