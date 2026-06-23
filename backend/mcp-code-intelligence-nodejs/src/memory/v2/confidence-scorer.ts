/**
 * KSA-80: Confidence Scoring for Search Results.
 */

import type Database from 'better-sqlite3';

const CONFIDENCE_WEIGHTS = { quality: 0.3, citations: 0.25, feedback: 0.25, freshness: 0.2 };

export class ConfidenceScorer {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'stats';

    switch (action) {
      case 'compute': return this.computeConfidence(args);
      case 'batch': return JSON.stringify(this.batchCompute(args));
      case 'unreliable': return JSON.stringify(this.getUnreliable(args), null, 2);
      default: return JSON.stringify(this.getStats(), null, 2);
    }
  }

  private computeConfidence(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    const entry = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(entryId) as any;
    if (!entry) return `Error: entry ${entryId} not found`;

    const qualityScore = this.getQualitySignal(entryId);
    const citationScore = this.getCitationSignal(entryId);
    const feedbackScore = this.getFeedbackSignal(entryId);
    const freshnessScore = this.getFreshnessSignal(entry);

    const confidence = CONFIDENCE_WEIGHTS.quality * qualityScore
      + CONFIDENCE_WEIGHTS.citations * citationScore
      + CONFIDENCE_WEIGHTS.feedback * feedbackScore
      + CONFIDENCE_WEIGHTS.freshness * freshnessScore;

    const normalized = Math.min(Math.max(confidence / 100, 0), 1);
    this.db.prepare("UPDATE knowledge_entries SET confidence = ?, updated_at = datetime('now') WHERE id = ?").run(normalized, entryId);
    return JSON.stringify({ entry_id: entryId, confidence: Math.round(normalized * 1000) / 1000, signals: { quality: qualityScore, citations: citationScore, feedback: feedbackScore, freshness: freshnessScore } }, null, 2);
  }

  private batchCompute(args: Record<string, unknown>): object {
    const limit = (args.limit as number) ?? 200;
    const rows = this.db.prepare('SELECT id FROM knowledge_entries WHERE archived_at IS NULL LIMIT ?').all(limit) as any[];
    let computed = 0;
    for (const row of rows) {
      this.computeConfidence({ entry_id: row.id });
      computed++;
    }
    return { computed, total: rows.length };
  }

  private getUnreliable(args: Record<string, unknown>): object[] {
    const limit = (args.limit as number) ?? 20;
    return this.db.prepare(
      'SELECT id, summary, type, confidence, feedback_score FROM knowledge_entries WHERE confidence < 0.4 AND archived_at IS NULL ORDER BY confidence ASC LIMIT ?'
    ).all(limit) as object[];
  }

  private getStats(): object {
    const avg = this.db.prepare('SELECT AVG(confidence) as avg FROM knowledge_entries WHERE archived_at IS NULL').get() as any;
    const low = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE confidence < 0.4 AND archived_at IS NULL').get() as any;
    const high = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE confidence >= 0.8 AND archived_at IS NULL').get() as any;
    return { avg_confidence: Math.round((avg.avg ?? 0) * 1000) / 1000, low_confidence_count: low.cnt, high_confidence_count: high.cnt };
  }

  private getQualitySignal(entryId: number): number {
    const row = this.db.prepare('SELECT total_score FROM quality_scores WHERE entry_id = ?').get(entryId) as any;
    return row?.total_score ?? 50;
  }

  private getCitationSignal(entryId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM citations WHERE entry_id = ?').get(entryId) as any;
    const count = row?.cnt ?? 0;
    if (count >= 10) return 100;
    if (count >= 5) return 80;
    if (count >= 2) return 60;
    if (count >= 1) return 40;
    return 20;
  }

  private getFeedbackSignal(entryId: number): number {
    const row = this.db.prepare('SELECT feedback_score FROM knowledge_entries WHERE id = ?').get(entryId) as any;
    const score = row?.feedback_score ?? 0;
    if (score >= 5) return 100;
    if (score >= 2) return 80;
    if (score >= 0) return 60;
    if (score >= -2) return 40;
    return 20;
  }

  private getFreshnessSignal(entry: any): number {
    if (!entry.updated_at) return 30;
    const days = (Date.now() - new Date(entry.updated_at).getTime()) / 86400000;
    if (days < 7) return 100;
    if (days < 30) return 80;
    if (days < 90) return 60;
    return 30;
  }
}
