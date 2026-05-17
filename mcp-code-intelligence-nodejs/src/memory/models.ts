/**
 * Data models for the memory engine — entries, edges, sessions, audit.
 */

/** Knowledge entry stored in memory system. */
export interface KnowledgeEntry {
  id: number;
  content: string;
  summary: string;
  type: string;
  tier: string;
  source: string | null;
  source_ref: string | null;
  tags: string;
  confidence: number;
  access_count: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  expires_at: string | null;
}

/** Search result with relevance score. */
export interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
  matchType: string;
}

/** Graph edge between two knowledge entries. */
export interface GraphEdge {
  id: number;
  source_id: number;
  target_id: number;
  relation: string;
  weight: number;
  metadata: string | null;
  created_at: string;
}

/** Memory session record. */
export interface MemorySession {
  id: number;
  session_id: string;
  agent_name: string | null;
  started_at: string;
  ended_at: string | null;
  observation_count: number;
  status: string;
}

/** Audit trail entry. */
export interface AuditEntry {
  id: number;
  operation: string;
  entry_id: number | null;
  session_id: string | null;
  agent_name: string | null;
  details: string | null;
  created_at: string;
}

/** Tier statistics. */
export interface TierStats {
  tier: string;
  entryCount: number;
  avgConfidence: number;
  avgAccessCount: number;
}

/** Consolidation result. */
export interface ConsolidationResult {
  promoted: number;
  demoted: number;
  expired: number;
}
