/**
 * AutoLinkConfig — configuration interface and defaults for auto-linking strategies.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */

export interface AutoLinkConfig {
  enabled: boolean;
  semantic: { enabled: boolean; minScore: number; maxEdges: number };
  entity: { enabled: boolean; minJaccard: number; maxEdges: number };
  tag: { enabled: boolean; minOverlap: number; maxEdges: number };
  fts: { enabled: boolean; maxEdges: number; fallbackThreshold: number };
  totalMaxEdges: number;
}

export function defaultAutoLinkConfig(): AutoLinkConfig {
  return {
    enabled: true,
    semantic: { enabled: true, minScore: 0.75, maxEdges: 5 },
    entity: { enabled: true, minJaccard: 0.3, maxEdges: 5 },
    tag: { enabled: true, minOverlap: 2, maxEdges: 3 },
    fts: { enabled: true, maxEdges: 3, fallbackThreshold: 2 },
    totalMaxEdges: 10,
  };
}
