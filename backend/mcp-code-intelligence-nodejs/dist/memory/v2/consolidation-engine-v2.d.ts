/**
 * KSA-69: Real Consolidation Engine — Promote/Demote/Merge with dry-run.
 */
import type Database from 'better-sqlite3';
export declare class ConsolidationEngineV2 {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    private handleConsolidate;
    private handleMerge;
    private mergeEntries;
    private promoteEligible;
    private demoteInactive;
    private mergeDuplicates;
    private transition;
    private getEntry;
    private applyStrategy;
}
//# sourceMappingURL=consolidation-engine-v2.d.ts.map