/**
 * TierConsolidator — promotes/demotes entries between 4 tiers.
 * WORKING → EPISODIC → SEMANTIC → PROCEDURAL
 */
import { ConsolidationResult } from './models.js';
import { KnowledgeRepository } from './knowledge-repo.js';
import { ConsolidationRepository } from './consolidation-repo.js';
interface ConsolidationConfig {
    workingToEpisodicAccess: number;
    workingToEpisodicConfidence: number;
    episodicToSemanticAccess: number;
    episodicToSemanticConfidence: number;
    semanticToProceduralAccess: number;
    semanticToProceduralConfidence: number;
}
export declare class TierConsolidator {
    private readonly knowledgeRepo;
    private readonly consolidationRepo;
    private readonly config;
    constructor(knowledgeRepo: KnowledgeRepository, consolidationRepo: ConsolidationRepository, config?: ConsolidationConfig);
    /** Run full consolidation cycle. */
    consolidate(): ConsolidationResult;
    /** Fix entries whose tier doesn't match their type (legacy data). */
    private fixTierMismatches;
    /** Determine correct tier based on knowledge type. */
    private tierForType;
    private promoteEligible;
    private promoteFromTier;
    private expireStale;
}
export {};
//# sourceMappingURL=tier-consolidator.d.ts.map