/**
 * AutoLinker — orchestrates all linking strategies, dedup, and commit.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 *
 * Fire-and-forget safe: errors never propagate to caller.
 */
import { GraphRepository } from './graph-repo.js';
import { AutoLinkConfig } from './auto-link-config.js';
import type { LinkingStrategy, AutoLinkResult } from './linking-strategies/types.js';
export declare class AutoLinker {
    private readonly strategies;
    private readonly graphRepo;
    private readonly config;
    constructor(graphRepo: GraphRepository, strategies: LinkingStrategy[], config?: Partial<AutoLinkConfig>);
    /** Link a single entry to related entries. Fire-and-forget safe. */
    link(entryId: number): AutoLinkResult;
    /** Batch backfill: link orphan entries (no edges). */
    backfill(entryId?: number, limit?: number): string;
    private dedup;
    private countByType;
}
//# sourceMappingURL=auto-linker.d.ts.map