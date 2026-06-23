/**
 * CoreMemoryManager — manages pinned entries for auto-recall.
 * Pinned entries are injected into agent context on every search.
 * Enforces a 2000-token budget across all pinned entries.
 */
import Database from 'better-sqlite3';
export interface CoreMemoryConfig {
    maxTokens: number;
    warningThreshold: number;
    maxPinnedEntries: number;
}
export interface PinnedEntrySummary {
    id: number;
    summary: string;
    tokens: number;
    pin_order: number;
}
export declare class CoreMemoryManager {
    private readonly db;
    private readonly config;
    constructor(db: Database.Database, config?: Partial<CoreMemoryConfig>);
    /** Pin an entry. Returns success/failure message. */
    pin(entryId: number): string;
    /** Unpin an entry. */
    unpin(entryId: number): string;
    /** List all pinned entries with token usage. */
    listPinned(): PinnedEntrySummary[];
    /** Reorder a pinned entry to a new position. */
    reorder(entryId: number, newOrder: number): string;
    /** Get pinned context string for injection into search results. */
    getContext(): string;
    /** Get token budget status. */
    getBudgetStatus(): {
        used: number;
        remaining: number;
        max: number;
        warning: boolean;
    };
    private getEntry;
    private getPinnedCount;
    private getNextPinOrder;
    private getUsedTokens;
    private getRemainingBudget;
}
//# sourceMappingURL=core-memory.d.ts.map