"use strict";
/**
 * TierConsolidator — promotes/demotes entries between 4 tiers.
 * WORKING → EPISODIC → SEMANTIC → PROCEDURAL
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TierConsolidator = void 0;
const DEFAULT_CONFIG = {
    workingToEpisodicAccess: 3,
    workingToEpisodicConfidence: 0.7,
    episodicToSemanticAccess: 10,
    episodicToSemanticConfidence: 0.85,
    semanticToProceduralAccess: 25,
    semanticToProceduralConfidence: 0.95,
};
class TierConsolidator {
    knowledgeRepo;
    consolidationRepo;
    config;
    constructor(knowledgeRepo, consolidationRepo, config = DEFAULT_CONFIG) {
        this.knowledgeRepo = knowledgeRepo;
        this.consolidationRepo = consolidationRepo;
        this.config = config;
    }
    /** Run full consolidation cycle. */
    consolidate() {
        const fixed = this.fixTierMismatches();
        const promoted = this.promoteEligible();
        const expired = this.expireStale();
        return { promoted: promoted + fixed, demoted: 0, expired };
    }
    /** Fix entries whose tier doesn't match their type (legacy data). */
    fixTierMismatches() {
        const working = this.knowledgeRepo.findByTier('WORKING', 1000);
        let fixed = 0;
        for (const entry of working) {
            const correctTier = this.tierForType(entry.type);
            if (correctTier !== 'WORKING') {
                this.knowledgeRepo.updateTier(entry.id, correctTier);
                this.consolidationRepo.logTransition(entry.id, 'WORKING', correctTier, 'auto:tier_fix');
                fixed++;
            }
        }
        return fixed;
    }
    /** Determine correct tier based on knowledge type. */
    tierForType(type) {
        switch (type) {
            case 'REQUIREMENT':
            case 'ARCHITECTURE':
            case 'PROCEDURE':
            case 'API_DESIGN':
                return 'SEMANTIC';
            case 'DECISION':
            case 'LESSON_LEARNED':
            case 'ERROR_PATTERN':
                return 'EPISODIC';
            default:
                return 'WORKING';
        }
    }
    promoteEligible() {
        let count = 0;
        count += this.promoteFromTier('WORKING', 'EPISODIC', this.config.workingToEpisodicAccess, this.config.workingToEpisodicConfidence);
        count += this.promoteFromTier('EPISODIC', 'SEMANTIC', this.config.episodicToSemanticAccess, this.config.episodicToSemanticConfidence);
        count += this.promoteFromTier('SEMANTIC', 'PROCEDURAL', this.config.semanticToProceduralAccess, this.config.semanticToProceduralConfidence);
        return count;
    }
    promoteFromTier(from, to, minAccess, minConf) {
        const candidates = this.consolidationRepo.findPromotionCandidates(from, minAccess, minConf);
        for (const id of candidates) {
            this.knowledgeRepo.updateTier(id, to);
            this.consolidationRepo.logTransition(id, from, to, 'auto:threshold_met');
        }
        return candidates.length;
    }
    expireStale() {
        const working = this.knowledgeRepo.findByTier('WORKING', 500);
        let expired = 0;
        const now = new Date().toISOString();
        for (const entry of working) {
            if (entry.expires_at && entry.expires_at < now) {
                this.knowledgeRepo.delete(entry.id);
                expired++;
            }
        }
        return expired;
    }
}
exports.TierConsolidator = TierConsolidator;
//# sourceMappingURL=tier-consolidator.js.map