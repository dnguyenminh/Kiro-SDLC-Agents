/**
 * PromotionService — auto-promotion logic between KB tiers.
 * Implements TDD §5.2, FSD UC-7/UC-8, BR-12, BR-13, BR-14.
 */
import { KbRepository } from './KbRepository';
import { PromoteResponse } from './types';
export declare class PromotionService {
    private readonly kbRepo;
    constructor(kbRepo: KbRepository);
    /**
     * Run auto-promotion check for User→Project (BR-12).
     * Criteria: quality_score > 0.8 AND tag "project-relevant" AND reviewed_by >= 1
     */
    promoteUserToProject(): PromoteResponse[];
    /**
     * Run auto-promotion check for Project→Shared (BR-13).
     * Criteria: referenced_by >= 3 OR tag "best-practice" OR admin_promoted
     */
    promoteProjectToShared(): PromoteResponse[];
    /**
     * Manual promotion by user or admin.
     */
    manualPromote(entryId: string, targetTier: 2 | 3, projectId: string | undefined, promotedBy: string): PromoteResponse;
}
//# sourceMappingURL=PromotionService.d.ts.map