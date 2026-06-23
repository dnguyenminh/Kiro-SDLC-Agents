/**
 * KSA-74: Content Quality Scoring & Validation.
 */

import type Database from 'better-sqlite3';

const QUALITY_DIMENSIONS = {
  length: { weight: 0.2, minChars: 50, goodChars: 500 },
  structure: { weight: 0.2 },
  metadata: { weight: 0.2 },
  freshness: { weight: 0.2, staleDays: 180 },
  engagement: { weight: 0.2 },
};

export class QualityScorer {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'stats';

    switch (action) {
      case 'score': return this.scoreEntry(args);
      case 'score_all': return JSON.stringify(this.scoreAll(args));
      case 'low_quality': return JSON.stringify(this.getLowQuality(args), null, 2);
      case 'validate': return this.validateContent(args);
      default: return JSON.stringify(this.getStats(), null, 2);
    }
  }

  private scoreEntry(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required';
    const entry = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(entryId) as any;
    if (!entry) return `Error: entry ${entryId} not found`;
    const dimensions = this.computeDimensions(entry);
    const total = Object.values(dimensions).reduce((s, d: any) => s + d.score * d.weight, 0);
    this.db.prepare('INSERT OR REPLACE INTO quality_scores (entry_id, total_score, dimensions) VALUES (?, ?, ?)').run(entryId, total, JSON.stringify(dimensions));
    return JSON.stringify({ entry_id: entryId, total_score: Math.round(total), dimensions }, null, 2);
  }

  private scoreAll(args: Record<string, unknown>): object {
    const limit = (args.limit as number) ?? 100;
    const rows = this.db.prepare('SELECT id FROM knowledge_entries WHERE archived_at IS NULL LIMIT ?').all(limit) as any[];
    let scored = 0;
    for (const row of rows) {
      this.scoreEntry({ entry_id: row.id });
      scored++;
    }
    return { scored, total: rows.length };
  }

  private getLowQuality(args: Record<string, unknown>): object[] {
    const threshold = (args.threshold as number) ?? 40;
    const limit = (args.limit as number) ?? 20;
    return this.db.prepare(
      'SELECT qs.entry_id, qs.total_score, ke.summary, ke.type FROM quality_scores qs JOIN knowledge_entries ke ON qs.entry_id = ke.id WHERE qs.total_score < ? ORDER BY qs.total_score ASC LIMIT ?'
    ).all(threshold, limit) as object[];
  }

  private validateContent(args: Record<string, unknown>): string {
    const content = args.content as string ?? '';
    if (!content) return 'Error: content required for validate';
    const issues: string[] = [];
    if (content.length < 50) issues.push('Content too short (min 50 chars)');
    if (!content.includes('\n')) issues.push('No structure (single line)');
    if (content.split(/\s+/).length < 10) issues.push('Too few words (min 10)');
    return JSON.stringify({ valid: issues.length === 0, issues, char_count: content.length });
  }

  private getStats(): object {
    const total = this.db.prepare('SELECT COUNT(*) as cnt FROM quality_scores').get() as any;
    const avg = this.db.prepare('SELECT AVG(total_score) as avg FROM quality_scores').get() as any;
    const low = this.db.prepare('SELECT COUNT(*) as cnt FROM quality_scores WHERE total_score < 40').get() as any;
    return { total_scored: total.cnt, avg_score: Math.round((avg.avg ?? 0) * 10) / 10, low_quality_count: low.cnt };
  }

  private computeDimensions(entry: any): Record<string, object> {
    return {
      length: { score: this.scoreLength(entry.content), weight: QUALITY_DIMENSIONS.length.weight },
      structure: { score: this.scoreStructure(entry.content), weight: QUALITY_DIMENSIONS.structure.weight },
      metadata: { score: this.scoreMetadata(entry), weight: QUALITY_DIMENSIONS.metadata.weight },
      freshness: { score: this.scoreFreshness(entry), weight: QUALITY_DIMENSIONS.freshness.weight },
      engagement: { score: this.scoreEngagement(entry), weight: QUALITY_DIMENSIONS.engagement.weight },
    };
  }

  private scoreLength(content: string): number {
    const len = content?.length ?? 0;
    if (len < 50) return 20;
    if (len < 200) return 50;
    if (len < 500) return 75;
    return 100;
  }

  private scoreStructure(content: string): number {
    if (!content) return 0;
    let score = 40;
    if (content.includes('\n')) score += 20;
    if (content.includes('##') || content.includes('**')) score += 20;
    if (content.includes('- ') || content.includes('1.')) score += 20;
    return Math.min(score, 100);
  }

  private scoreMetadata(entry: any): number {
    let score = 0;
    if (entry.tags) score += 30;
    if (entry.source) score += 30;
    if (entry.owner) score += 20;
    if (entry.type !== 'CONTEXT') score += 20;
    return Math.min(score, 100);
  }

  private scoreFreshness(entry: any): number {
    if (!entry.updated_at) return 30;
    const days = (Date.now() - new Date(entry.updated_at).getTime()) / 86400000;
    if (days < 7) return 100;
    if (days < 30) return 80;
    if (days < 90) return 60;
    if (days < 180) return 40;
    return 20;
  }

  private scoreEngagement(entry: any): number {
    const access = entry.access_count ?? 0;
    if (access >= 20) return 100;
    if (access >= 10) return 80;
    if (access >= 5) return 60;
    if (access >= 1) return 40;
    return 20;
  }
}
