/**
 * TagStrategy — shared tag overlap linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */

import Database from 'better-sqlite3';
import type { LinkingStrategy, CandidateEdge } from './types.js';
import type { AutoLinkConfig } from '../auto-link-config.js';

export class TagStrategy implements LinkingStrategy {
  readonly name = 'tag';
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  isEnabled(config: AutoLinkConfig): boolean {
    return config.tag.enabled;
  }

  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[] {
    // Get tags for this entry
    const entry = this.db.prepare(
      'SELECT tags FROM knowledge_entries WHERE id = ?'
    ).get(entryId) as { tags: string } | undefined;
    if (!entry || !entry.tags) return [];

    const myTags = entry.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (myTags.length < config.tag.minOverlap) return [];

    // Find entries with overlapping tags
    const conditions = myTags.map(() => 'tags LIKE ?').join(' OR ');
    const params = myTags.map(t => `%${t}%`);
    const rows = this.db.prepare(
      `SELECT id, tags FROM knowledge_entries WHERE id != ? AND archived = 0 AND (${conditions})`
    ).all(entryId, ...params) as Array<{ id: number; tags: string }>;

    const candidates: CandidateEdge[] = [];
    for (const row of rows) {
      const otherTags = row.tags.split(',').map(t => t.trim()).filter(Boolean);
      const shared = myTags.filter(t => otherTags.includes(t));
      if (shared.length >= config.tag.minOverlap) {
        const union = new Set([...myTags, ...otherTags]);
        const jaccard = shared.length / union.size;
        candidates.push({
          targetId: row.id,
          relation: 'SHARES_TAG',
          score: jaccard,
          metadata: { shared_tags: shared, overlap_count: shared.length },
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, config.tag.maxEdges);
  }
}
