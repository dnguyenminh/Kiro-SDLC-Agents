/**
 * AutoLinker — orchestrates all linking strategies, dedup, and commit.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 *
 * Fire-and-forget safe: errors never propagate to caller.
 */

import { GraphRepository } from './graph-repo.js';
import { AutoLinkConfig, defaultAutoLinkConfig } from './auto-link-config.js';
import type { LinkingStrategy, CandidateEdge, AutoLinkResult } from './linking-strategies/types.js';

export class AutoLinker {
  private readonly strategies: LinkingStrategy[];
  private readonly graphRepo: GraphRepository;
  private readonly config: AutoLinkConfig;

  constructor(
    graphRepo: GraphRepository,
    strategies: LinkingStrategy[],
    config?: Partial<AutoLinkConfig>
  ) {
    this.graphRepo = graphRepo;
    this.strategies = strategies;
    this.config = { ...defaultAutoLinkConfig(), ...config };
  }

  /** Link a single entry to related entries. Fire-and-forget safe. */
  link(entryId: number): AutoLinkResult {
    if (!this.config.enabled) {
      return { entryId, edgesCreated: 0, breakdown: { semantic: 0, entity: 0, tag: 0, fts: 0 }, skipped: 0, timeMs: 0 };
    }

    const start = Date.now();
    const allCandidates: CandidateEdge[] = [];

    for (const strategy of this.strategies) {
      if (!strategy.isEnabled(this.config)) continue;

      // FTS fallback check: skip if already have enough edges from prior strategies
      if (strategy.name === 'fts' && allCandidates.length >= this.config.fts.fallbackThreshold) {
        continue;
      }

      try {
        const candidates = strategy.findCandidates(entryId, this.config);
        allCandidates.push(...candidates);
      } catch (err) {
        process.stderr.write(`[auto-link] Strategy ${strategy.name} failed for #${entryId}: ${err}\n`);
      }
    }

    // Dedup and cap
    const deduped = this.dedup(entryId, allCandidates);
    const capped = deduped.slice(0, this.config.totalMaxEdges);

    // Commit edges
    let created = 0, skipped = 0;
    for (const edge of capped) {
      try {
        if (this.graphRepo.edgeExists(edge.targetId, entryId, edge.relation)) {
          skipped++;
        } else {
          this.graphRepo.addEdge({
            source_id: entryId,
            target_id: edge.targetId,
            relation: edge.relation,
            weight: edge.score,
            metadata: JSON.stringify(edge.metadata),
          });
          created++;
        }
      } catch (err) {
        process.stderr.write(`[auto-link] Edge commit failed for #${entryId} -> #${edge.targetId}: ${err}\n`);
      }
    }

    const timeMs = Date.now() - start;
    process.stderr.write(`[auto-link] Entry #${entryId}: ${created} edges created (${timeMs}ms)\n`);

    return {
      entryId,
      edgesCreated: created,
      breakdown: this.countByType(capped),
      skipped,
      timeMs,
    };
  }

  /** Batch backfill: link orphan entries (no edges). */
  backfill(entryId?: number, limit = 50): string {
    if (entryId) {
      const result = this.link(entryId);
      return `Auto-linked entry #${entryId}: ${result.edgesCreated} edges created. Time: ${result.timeMs}ms`;
    }
    // Find orphans
    const orphans = this.graphRepo.findOrphans(limit);
    let totalEdges = 0;
    for (const id of orphans) {
      const result = this.link(id);
      totalEdges += result.edgesCreated;
    }
    return `Backfill: processed ${orphans.length} entries, created ${totalEdges} edges`;
  }

  private dedup(sourceId: number, candidates: CandidateEdge[]): CandidateEdge[] {
    // Remove self-links
    const filtered = candidates.filter(c => c.targetId !== sourceId);
    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);
    // Remove duplicates (same target + relation)
    const seen = new Set<string>();
    return filtered.filter(c => {
      const key = `${c.targetId}:${c.relation}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private countByType(edges: CandidateEdge[]): { semantic: number; entity: number; tag: number; fts: number } {
    const counts = { semantic: 0, entity: 0, tag: 0, fts: 0 };
    for (const e of edges) {
      if (e.relation === 'SIMILAR_TO') counts.semantic++;
      else if (e.relation === 'SHARES_ENTITY') counts.entity++;
      else if (e.relation === 'SHARES_TAG') counts.tag++;
      else if (e.relation === 'TOPIC_OVERLAP') counts.fts++;
    }
    return counts;
  }
}
