/**
 * WorkingTierExpiry — lazy auto-expiry of stale WORKING tier entries.
 * Runs on every mem_search call (no background threads).
 * Entries older than expiryHours are promoted (quality ≥ 60) or archived.
 * Pinned entries are exempt from expiry (BR-F1-05).
 */
import Database from 'better-sqlite3';
export interface ExpiryAction {
    entry_id: number;
    action: 'promoted' | 'archived';
    quality_score: number;
    to_tier?: string;
}
export declare class WorkingTierExpiry {
    private readonly db;
    private readonly expiryHours;
    private readonly promoteThreshold;
    constructor(db: Database.Database, options?: {
        expiryHours?: number;
        promoteThreshold?: number;
    });
    /** Process stale WORKING entries. Returns actions taken. */
    processStale(): ExpiryAction[];
    /** Find WORKING entries older than expiryHours, excluding pinned. */
    private getStaleEntries;
}
//# sourceMappingURL=working-tier-expiry.d.ts.map