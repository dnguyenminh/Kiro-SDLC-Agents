/**
 * KSA-74: Content Quality Scoring & Validation.
 */
import type Database from 'better-sqlite3';
export declare class QualityScorer {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private scoreEntry;
    private scoreAll;
    private getLowQuality;
    private validateContent;
    private getStats;
    private computeDimensions;
    private scoreLength;
    private scoreStructure;
    private scoreMetadata;
    private scoreFreshness;
    private scoreEngagement;
}
//# sourceMappingURL=quality-scorer.d.ts.map