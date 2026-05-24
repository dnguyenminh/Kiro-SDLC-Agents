"use strict";
/**
 * KSA-78: Search Analytics & Query Optimization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchAnalytics = void 0;
class SearchAnalytics {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const action = args.action ?? 'summary';
        const limit = args.limit ?? 10;
        switch (action) {
            case 'popular': return JSON.stringify(this.getPopularQueries(limit), null, 2);
            case 'gaps': return JSON.stringify(this.getContentGaps(), null, 2);
            case 'zero_results': return JSON.stringify(this.getZeroResultQueries(limit), null, 2);
            default: return JSON.stringify(this.getSummary(), null, 2);
        }
    }
    /** Log a search query for analytics. Called by search handler. */
    logSearch(query, resultCount, topResultId) {
        try {
            this.db.prepare('INSERT INTO search_log (query, result_count, top_result_id) VALUES (?, ?, ?)').run(query, resultCount, topResultId ?? null);
            this.db.prepare('INSERT INTO popular_queries (query, hit_count, avg_results, last_searched) VALUES (?, 1, ?, datetime(\'now\')) ON CONFLICT(query) DO UPDATE SET hit_count = hit_count + 1, avg_results = (avg_results * (hit_count - 1) + ?) / hit_count, last_searched = datetime(\'now\')').run(query, resultCount, resultCount);
        }
        catch { /* analytics should never break main flow */ }
    }
    getPopularQueries(limit) {
        return this.db.prepare('SELECT query, hit_count, avg_results, last_searched FROM popular_queries ORDER BY hit_count DESC LIMIT ?').all(limit);
    }
    getZeroResultQueries(limit) {
        return this.db.prepare('SELECT query, hit_count, last_searched FROM popular_queries WHERE avg_results = 0 ORDER BY hit_count DESC LIMIT ?').all(limit);
    }
    getContentGaps() {
        const zeroResults = this.db.prepare('SELECT COUNT(*) as cnt FROM popular_queries WHERE avg_results = 0').get();
        const totalQueries = this.db.prepare('SELECT COUNT(*) as cnt FROM popular_queries').get();
        const topGaps = this.db.prepare('SELECT query, hit_count FROM popular_queries WHERE avg_results = 0 ORDER BY hit_count DESC LIMIT 10').all();
        return { total_queries: totalQueries.cnt, zero_result_queries: zeroResults.cnt, gap_rate: totalQueries.cnt > 0 ? (zeroResults.cnt / totalQueries.cnt * 100).toFixed(1) + '%' : '0%', top_gaps: topGaps };
    }
    getSummary() {
        const total = this.db.prepare('SELECT COUNT(*) as cnt FROM search_log').get();
        const unique = this.db.prepare('SELECT COUNT(*) as cnt FROM popular_queries').get();
        const avgResults = this.db.prepare('SELECT AVG(result_count) as avg FROM search_log').get();
        return { total_searches: total.cnt, unique_queries: unique.cnt, avg_results_per_search: Math.round((avgResults.avg ?? 0) * 10) / 10 };
    }
}
exports.SearchAnalytics = SearchAnalytics;
//# sourceMappingURL=search-analytics.js.map