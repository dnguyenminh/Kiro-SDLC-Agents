/**
 * Shared interfaces for auto-linking strategies.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
import type { AutoLinkConfig } from '../auto-link-config.js';
export interface CandidateEdge {
    targetId: number;
    relation: string;
    score: number;
    metadata: Record<string, unknown>;
}
export interface AutoLinkResult {
    entryId: number;
    edgesCreated: number;
    breakdown: {
        semantic: number;
        entity: number;
        tag: number;
        fts: number;
    };
    skipped: number;
    timeMs: number;
}
export interface LinkingStrategy {
    readonly name: string;
    isEnabled(config: AutoLinkConfig): boolean;
    findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[];
}
//# sourceMappingURL=types.d.ts.map