/**
 * FtsStrategy — full-text search fallback linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
import Database from 'better-sqlite3';
import type { LinkingStrategy, CandidateEdge } from './types.js';
import type { AutoLinkConfig } from '../auto-link-config.js';
export declare class FtsStrategy implements LinkingStrategy {
    readonly name = "fts";
    private readonly db;
    constructor(db: Database.Database);
    isEnabled(config: AutoLinkConfig): boolean;
    findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[];
}
//# sourceMappingURL=fts-strategy.d.ts.map