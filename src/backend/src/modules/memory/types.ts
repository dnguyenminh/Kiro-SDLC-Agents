/**
 * Multi-tenant KB types.
 * Implements TDD §5.2 modules/memory/types.ts.
 */

export interface KbEntry {
  id: string;
  tier: 1 | 2 | 3;
  owner_id: string;
  project_id: string | null;
  title: string | null;
  content: string;
  content_hash: string;
  embedding: Buffer | null;
  tags: string; // JSON array stored as text
  quality_score: number;
  ttl_days: number | null;
  promoted: number;
  promoted_from: string | null;
  promoted_by: string | null;
  referenced_by_projects: string; // JSON array stored as text
  admin_promoted: number;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  entry: KbEntry;
  similarity: number;
  boosted_score: number;
  tier_badge: string;
}

export interface TierAccessContext {
  userId: string;
  projects: string[];
  role: 'user' | 'admin';
}

export interface IngestRequest {
  title: string;
  content: string;
  tags?: string;
  tier?: 1 | 2 | 3;
  project?: string;
}

export interface PromoteRequest {
  entry_id: string;
  target_tier: 2 | 3;
  project_id?: string;
}

export interface PromoteResponse {
  promoted_entry_id: string;
  source_entry_id: string;
  from_tier: number;
  to_tier: number;
  promoted_at: string;
}

// BR-19: Tier boost factors for search ranking
export const TIER_BOOST_FACTORS = {
  1: 1.2,
  2: 1.0,
  3: 0.9,
} as const;
