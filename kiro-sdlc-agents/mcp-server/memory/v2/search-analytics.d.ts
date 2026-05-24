/**
 * KSA-78: Search Analytics & Query Optimization.
 */
import type Database from 'better-sqlite3';
export declare class SearchAnalytics {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    /** Log a search query for analytics. Called by search handler. */
    logSearch(query: string, resultCount: number, topResultId?: number): void;
    private getPopularQueries;
    private getZeroResultQueries;
    private getContentGaps;
    private getSummary;
}
//# sourceMappingURL=search-analytics.d.ts.map