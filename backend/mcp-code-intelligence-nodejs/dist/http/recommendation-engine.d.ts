/**
 * RecommendationEngine — generates prioritized KB improvement suggestions.
 * Port of Python recommendation_engine.py.
 */
import Database from 'better-sqlite3';
interface Recommendation {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    entry_id: number;
    action: {
        label: string;
        endpoint: string;
        method: string;
        confirm: boolean;
    } | null;
}
interface RecommendationResult {
    recommendations: Recommendation[];
    total: number;
}
export declare class RecommendationEngine {
    private readonly db;
    constructor(db: Database.Database);
    getRecommendations(limit?: number): RecommendationResult;
    private findStaleEntries;
    private findUntaggedEntries;
    private findLowQuality;
    private findOrphanEntries;
}
export {};
//# sourceMappingURL=recommendation-engine.d.ts.map