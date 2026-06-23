/**
 * QualityGate — validates content before ingest to prevent KB pollution.
 * Checks: minimum length, duplicate detection, quality scoring.
 * Rejects entries with score < 30, warns for score 30-50.
 */
import Database from 'better-sqlite3';
export interface QualityResult {
    score: number;
    decision: 'accept' | 'warn' | 'reject';
    message: string | null;
    duplicate_detected: boolean;
    duplicate_entry_id: number | null;
}
export interface IngestMeta {
    tags?: string | string[];
    type?: string;
    source?: string;
}
export declare class QualityGate {
    private readonly db;
    private readonly minLength;
    private readonly rejectThreshold;
    private readonly warnThreshold;
    private readonly duplicateThreshold;
    constructor(db: Database.Database, options?: {
        minLength?: number;
        rejectThreshold?: number;
        warnThreshold?: number;
        duplicateThreshold?: number;
    });
    /** Validate content before ingest. Returns quality decision. */
    validate(content: string, meta: IngestMeta): QualityResult;
    /** Calculate quality score (0-100) based on content and metadata. */
    private calculateScore;
    /** Check for near-duplicate content using trigram similarity. */
    private checkDuplicate;
    private decideFromScore;
}
//# sourceMappingURL=quality-gate.d.ts.map