"use strict";
/**
 * KSA-84: KB Health Dashboard & Metrics.
 *
 * Uses unified formula consistent across NodeJS/Python/Kotlin:
 *   total_entries = COUNT(*) FROM knowledge_entries (no filters)
 *   stale_count = updated_at < -90 days
 *   unowned_count = source IS NULL OR source = ''
 *   health_score = qualityAvg * 0.4 + staleRatio * 0.3 + ownedRatio * 0.3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthDashboard = void 0;
class HealthDashboard {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const action = args.action ?? 'full';
        switch (action) {
            case 'metrics': return JSON.stringify(this.getMetrics(), null, 2);
            case 'recommendations': return JSON.stringify(this.getRecommendations(), null, 2);
            case 'trends': return JSON.stringify(this.getTrends(args), null, 2);
            default: return JSON.stringify(this.getFull(), null, 2);
        }
    }
    getFull() {
        const metrics = this.getMetrics();
        const total = metrics.total_entries;
        const qualityAvg = metrics.quality_avg;
        const staleCount = metrics.stale_count;
        const unownedCount = metrics.unowned_count;
        const staleRatio = total > 0 ? (1 - staleCount / total) * 100 : 100;
        const ownedRatio = total > 0 ? (1 - unownedCount / total) * 100 : 100;
        const healthScore = total === 0 ? 0 :
            Math.round(Math.min(qualityAvg, 100) * 0.4 + staleRatio * 0.3 + ownedRatio * 0.3);
        return {
            health_score: healthScore,
            total_entries: total,
            quality_avg: Math.round(Math.min(qualityAvg, 100) * 10) / 10,
            stale_count: staleCount,
            unowned_count: unownedCount,
            metrics,
            recommendations: this.getRecommendations(),
            trends: this.getTrends({ days: 7 }),
        };
    }
    getMetrics() {
        // No filters — count ALL entries
        const total = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries').get()?.cnt ?? 0;
        // Stale: not updated in 90+ days
        const staleCount = this.db.prepare("SELECT COUNT(*) as cnt FROM knowledge_entries WHERE updated_at < datetime('now', '-90 days')").get()?.cnt ?? 0;
        // Unowned: no source assigned
        const unownedCount = this.db.prepare("SELECT COUNT(*) as cnt FROM knowledge_entries WHERE source IS NULL OR source = ''").get()?.cnt ?? 0;
        // Quality: average confidence
        const qualityAvg = this.db.prepare('SELECT AVG(confidence) as avg FROM knowledge_entries').get()?.avg ?? 0;
        return {
            total_entries: total,
            quality_avg: Math.round((qualityAvg ?? 0) * 10) / 10,
            stale_count: staleCount,
            unowned_count: unownedCount,
            ownership_rate: total > 0 ? Math.round((1 - unownedCount / total) * 100) : 0,
        };
    }
    getRecommendations() {
        const metrics = this.getMetrics();
        const recs = [];
        if (metrics.quality_avg < 60) {
            recs.push({ priority: 'high', message: 'Improve low-quality entries' });
        }
        if (metrics.total_entries > 0 && metrics.stale_count / metrics.total_entries > 0.3) {
            recs.push({ priority: 'high', message: `Review ${metrics.stale_count} stale entries` });
        }
        if (metrics.total_entries > 0 && metrics.unowned_count / metrics.total_entries > 0.5) {
            recs.push({ priority: 'medium', message: `Assign owners to ${metrics.unowned_count} entries` });
        }
        if (!recs.length)
            recs.push({ priority: 'low', message: 'KB is healthy' });
        return recs;
    }
    getTrends(args) {
        const days = args.days ?? 30;
        const searchVolume = [];
        const ingestVolume = [];
        try {
            const searchRows = this.db.prepare("SELECT DATE(searched_at) as date, COUNT(*) as count FROM search_log WHERE searched_at >= datetime('now', ?) GROUP BY DATE(searched_at) ORDER BY date").all(`-${days} days`);
            searchRows.forEach(r => searchVolume.push({ date: r.date, count: r.count }));
        }
        catch { /* table may not exist */ }
        try {
            const ingestRows = this.db.prepare("SELECT DATE(created_at) as date, COUNT(*) as count FROM memory_audit WHERE operation = 'INGEST' AND created_at >= datetime('now', ?) GROUP BY DATE(created_at) ORDER BY date").all(`-${days} days`);
            ingestRows.forEach(r => ingestVolume.push({ date: r.date, count: r.count }));
        }
        catch { /* table may not exist */ }
        return { period_days: days, search_volume: searchVolume, ingest_volume: ingestVolume };
    }
}
exports.HealthDashboard = HealthDashboard;
//# sourceMappingURL=health-dashboard.js.map