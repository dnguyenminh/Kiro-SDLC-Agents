/**
 * KSA-80: Confidence Scoring for Search Results.
 */
import type Database from 'better-sqlite3';
export declare class ConfidenceScorer {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private computeConfidence;
    private batchCompute;
    private getUnreliable;
    private getStats;
    private getQualitySignal;
    private getCitationSignal;
    private getFeedbackSignal;
    private getFreshnessSignal;
}
//# sourceMappingURL=confidence-scorer.d.ts.map