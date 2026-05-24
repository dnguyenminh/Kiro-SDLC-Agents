/**
 * KSA-79: Citation Tracking & Source Attribution.
 */
import type Database from 'better-sqlite3';
export declare class CitationTracker {
    private readonly db;
    constructor(db: Database.Database);
    executeCite(args: Record<string, unknown>): string;
    execute(args: Record<string, unknown>): string;
    private getCitationsForEntry;
    private getMostCited;
    private getUncited;
    private getCitationsByAgent;
}
//# sourceMappingURL=citation-tracker.d.ts.map