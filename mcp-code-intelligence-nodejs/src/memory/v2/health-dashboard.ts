/**
 * KSA-84: KB Health Dashboard & Metrics.
 */

import type Database from 'better-sqlite3';

export class HealthDashboard {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'full';

    switch (action) {
      case 'metrics': return JSON.stringify(this.getMetrics(), null, 2);
      case 'recommendations': return JSON.stringify(this.getRecommendations(), null, 2);
      case 'trends': return JSON.stringify(this.getTrends(args), null, 2);
      default: return JSON.stringify(this.getFull(), null, 2);
    }
  }

  private getFull(): object {
    return { metrics: this.getMetrics(), recommendations: this.getRecommendations() };
  }

  private getMetrics(): object {
    const total = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE archived_at IS NULL').get() as any;
    const archived = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE archived_at IS NOT NULL').get() as any;
    const withOwner = this.db.prepare("SELECT COUNT(*) as cnt FROM knowledge_entries WHERE owner IS NOT NULL AND owner != '' AND archived_at IS NULL").get() as any;
    const reviewed90 = this.db.prepare("SELECT COUNT(*) as cnt FROM knowledge_entries WHERE last_reviewed_at > datetime('now', '-90 days') AND archived_at IS NULL").get() as any;
    const avgQuality = this.db.prepare('SELECT AVG(total_score) as avg FROM quality_scores').get() as any;
    const avgConfidence = this.db.prepare('SELECT AVG(confidence) as avg FROM knowledge_entries WHERE archived_at IS NULL').get() as any;
    const zeroResults = this.db.prepare('SELECT COUNT(*) as cnt FROM popular_queries WHERE avg_results = 0').get() as any;
    const totalQueries = this.db.prepare('SELECT COUNT(*) as cnt FROM popular_queries').get() as any;

    return {
      total_entries: total.cnt,
      archived_entries: archived.cnt,
      ownership_rate: total.cnt > 0 ? Math.round(withOwner.cnt / total.cnt * 100) : 0,
      review_rate_90d: total.cnt > 0 ? Math.round(reviewed90.cnt / total.cnt * 100) : 0,
      avg_quality_score: Math.round((avgQuality.avg ?? 0) * 10) / 10,
      avg_confidence: Math.round((avgConfidence.avg ?? 0) * 1000) / 1000,
      zero_result_rate: totalQueries.cnt > 0 ? Math.round(zeroResults.cnt / totalQueries.cnt * 100) : 0,
    };
  }

  private getRecommendations(): object[] {
    const recs: object[] = [];
    const metrics = this.getMetrics() as any;
    if (metrics.ownership_rate < 80) recs.push({ priority: 'high', action: 'Assign owners to entries', detail: `Only ${metrics.ownership_rate}% have owners` });
    if (metrics.review_rate_90d < 60) recs.push({ priority: 'high', action: 'Review stale entries', detail: `Only ${metrics.review_rate_90d}% reviewed in 90 days` });
    if (metrics.avg_quality_score < 60) recs.push({ priority: 'medium', action: 'Improve content quality', detail: `Avg quality: ${metrics.avg_quality_score}/100` });
    if (metrics.zero_result_rate > 10) recs.push({ priority: 'medium', action: 'Fill content gaps', detail: `${metrics.zero_result_rate}% searches return no results` });
    if (!recs.length) recs.push({ priority: 'low', action: 'KB is healthy', detail: 'All metrics within acceptable range' });
    return recs;
  }

  private getTrends(args: Record<string, unknown>): object {
    const days = (args.days as number) ?? 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const newEntries = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE created_at > ?').get(cutoff) as any;
    const searches = this.db.prepare('SELECT COUNT(*) as cnt FROM search_log WHERE searched_at > ?').get(cutoff) as any;
    const citations = this.db.prepare('SELECT COUNT(*) as cnt FROM citations WHERE cited_at > ?').get(cutoff) as any;
    return { period_days: days, new_entries: newEntries.cnt, searches: searches.cnt, citations: citations.cnt };
  }
}
