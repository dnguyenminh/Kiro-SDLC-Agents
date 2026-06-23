/**
 * KSA-84: KB Health Dashboard & Metrics.
 *
 * Uses unified formula consistent across NodeJS/Python/Kotlin:
 *   total_entries = COUNT(*) FROM knowledge_entries (no filters)
 *   stale_count = updated_at < -90 days
 *   unowned_count = source IS NULL OR source = ''
 *   health_score = qualityAvg * 0.4 + staleRatio * 0.3 + ownedRatio * 0.3
 */
import type Database from 'better-sqlite3';
export declare class HealthDashboard {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private getFull;
    private getMetrics;
    private getRecommendations;
    private getTrends;
}
//# sourceMappingURL=health-dashboard.d.ts.map