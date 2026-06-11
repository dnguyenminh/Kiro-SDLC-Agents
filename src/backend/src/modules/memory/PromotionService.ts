/**
 * PromotionService — auto-promotion logic between KB tiers.
 * Implements TDD §5.2, FSD UC-7/UC-8, BR-12, BR-13, BR-14.
 */

import { KbRepository } from './KbRepository';
import { PromoteResponse } from './types';

export class PromotionService {
  constructor(private readonly kbRepo: KbRepository) {}

  /**
   * Run auto-promotion check for User→Project (BR-12).
   * Criteria: quality_score > 0.8 AND tag "project-relevant" AND reviewed_by >= 1
   */
  promoteUserToProject(): PromoteResponse[] {
    const candidates = this.kbRepo.findPromotionCandidates(1, 0.8);
    const promoted: PromoteResponse[] = [];

    for (const entry of candidates) {
      const tags = JSON.parse(entry.tags) as string[];
      const hasProjectTag = tags.includes('project-relevant');
      const hasReview = entry.promoted_by !== null;

      if (hasProjectTag && hasReview && entry.project_id) {
        const newEntry = this.kbRepo.create({
          title: entry.title ?? undefined,
          content: entry.content,
          tier: 2,
          owner_id: entry.owner_id,
          project_id: entry.project_id,
          tags,
          quality_score: entry.quality_score,
          promoted_from: entry.id,
          promoted_by: entry.promoted_by ?? undefined,
        });

        this.kbRepo.markPromoted(entry.id);

        promoted.push({
          promoted_entry_id: newEntry.id,
          source_entry_id: entry.id,
          from_tier: 1,
          to_tier: 2,
          promoted_at: new Date().toISOString(),
        });
      }
    }

    return promoted;
  }

  /**
   * Run auto-promotion check for Project→Shared (BR-13).
   * Criteria: referenced_by >= 3 OR tag "best-practice" OR admin_promoted
   */
  promoteProjectToShared(): PromoteResponse[] {
    const candidates = this.kbRepo.findPromotionCandidates(2, 0.0);
    const promoted: PromoteResponse[] = [];

    for (const entry of candidates) {
      const tags = JSON.parse(entry.tags) as string[];
      const referencedBy = JSON.parse(entry.referenced_by_projects) as string[];

      const hasCrossProjectUsage = referencedBy.length >= 3;
      const hasBestPracticeTag = tags.includes('best-practice');
      const isAdminPromoted = entry.admin_promoted === 1;

      if (hasCrossProjectUsage || hasBestPracticeTag || isAdminPromoted) {
        const newEntry = this.kbRepo.create({
          title: entry.title ?? undefined,
          content: entry.content,
          tier: 3,
          owner_id: entry.owner_id,
          tags,
          quality_score: entry.quality_score,
          promoted_from: entry.id,
        });

        this.kbRepo.markPromoted(entry.id);

        promoted.push({
          promoted_entry_id: newEntry.id,
          source_entry_id: entry.id,
          from_tier: 2,
          to_tier: 3,
          promoted_at: new Date().toISOString(),
        });
      }
    }

    return promoted;
  }

  /**
   * Manual promotion by user or admin.
   */
  manualPromote(entryId: string, targetTier: 2 | 3, projectId: string | undefined, promotedBy: string): PromoteResponse {
    const entry = this.kbRepo.findById(entryId);
    if (!entry) {
      throw new Error(`Entry ${entryId} not found`);
    }
    if (entry.promoted) {
      throw new Error(`Entry ${entryId} has already been promoted`);
    }

    const tags = JSON.parse(entry.tags) as string[];
    const newEntry = this.kbRepo.create({
      title: entry.title ?? undefined,
      content: entry.content,
      tier: targetTier,
      owner_id: entry.owner_id,
      project_id: projectId,
      tags,
      quality_score: entry.quality_score,
      promoted_from: entry.id,
      promoted_by: promotedBy,
    });

    this.kbRepo.markPromoted(entry.id);

    return {
      promoted_entry_id: newEntry.id,
      source_entry_id: entry.id,
      from_tier: entry.tier,
      to_tier: targetTier,
      promoted_at: new Date().toISOString(),
    };
  }
}
