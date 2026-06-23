/**
 * KSA-70: Staleness Detection & Auto-Archive + Review management.
 */
import type Database from 'better-sqlite3';
export declare class StalenessDetector {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    executeDueReviews(args: Record<string, unknown>): string;
    executeReview(args: Record<string, unknown>): string;
    private detectStale;
    private autoArchive;
    private unarchive;
    private getDueReviews;
    private markReviewed;
    private assignField;
    private setStatus;
    private recomputeStaleness;
    private computeScore;
    private archiveEntry;
}
//# sourceMappingURL=staleness-detector.d.ts.map