/**
 * KSA-76: Auto-Suggestions & Related Entries.
 */
import type Database from 'better-sqlite3';
export declare class SuggestionEngine {
    private readonly db;
    constructor(db: Database.Database);
    execute(args: Record<string, unknown>): string;
    executeRelated(args: Record<string, unknown>): string;
    private suggest;
    private fallbackSuggest;
    private getRelated;
    private refreshRelated;
    private computeRelated;
    private scoreByTags;
    private scoreByGraph;
    private scoreByFts;
    private getCachedRelated;
}
//# sourceMappingURL=suggestion-engine.d.ts.map