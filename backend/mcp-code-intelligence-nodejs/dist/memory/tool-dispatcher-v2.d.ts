/**
 * MemoryToolDispatcherV2 — routes V2 mem_* tool calls to handlers.
 * Handles 17 KB Enhancement tools (KSA-68).
 */
import type Database from 'better-sqlite3';
export declare class MemoryToolDispatcherV2 {
    private readonly consolidation;
    private readonly staleness;
    private readonly templates;
    private readonly attachments;
    private readonly suggestions;
    private readonly tags;
    private readonly analytics;
    private readonly citations;
    private readonly feedback;
    private readonly reminders;
    private readonly quality;
    private readonly confidence;
    private readonly dashboard;
    constructor(db: Database.Database);
    /** Dispatch a V2 memory tool call. Returns null if not handled. */
    dispatch(name: string, args: Record<string, unknown>): string | null;
}
//# sourceMappingURL=tool-dispatcher-v2.d.ts.map