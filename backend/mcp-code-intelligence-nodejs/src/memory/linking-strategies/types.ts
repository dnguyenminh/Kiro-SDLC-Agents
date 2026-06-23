/**
 * Shared interfaces for auto-linking strategies.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */

import type { AutoLinkConfig } from '../auto-link-config.js';

export interface CandidateEdge {
  targetId: number;
  relation: string;       // SIMILAR_TO | SHARES_ENTITY | SHARES_TAG | TOPIC_OVERLAP
  score: number;          // 0.0 - 1.0
  metadata: Record<string, unknown>;
}

export interface AutoLinkResult {
  entryId: number;
  edgesCreated: number;
  breakdown: { semantic: number; entity: number; tag: number; fts: number };
  skipped: number;
  timeMs: number;
}

export interface LinkingStrategy {
  readonly name: string;  // 'semantic' | 'entity' | 'tag' | 'fts'
  isEnabled(config: AutoLinkConfig): boolean;
  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[];
}
