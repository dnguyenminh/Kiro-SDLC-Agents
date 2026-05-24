/**
 * ConsolidationRepository — tier transition logging and statistics.
 */
import Database from 'better-sqlite3';
import { TierStats } from './models.js';
export declare class ConsolidationRepository {
    private readonly db;
    constructor(db: Database.Database);
    /** Log a tier transition. */
    logTransition(entryId: number, fromTier: string, toTier: string, reason: string): void;
    /** Get tier statistics (entry count, avg confidence, avg access). */
    getTierStats(): TierStats[];
    /** Find entries eligible for promotion. */
    findPromotionCandidates(tier: string, minAccess: number, minConfidence: number): number[];
}
//# sourceMappingURL=consolidation-repo.d.ts.map