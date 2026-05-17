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

const DEFAULT_CONFIG: ConsolidationConfig = {
  workingToEpisodicAccess: 3,
  workingToEpisodicConfidence: 0.7,
  episodicToSemanticAccess: 10,
  episodicToSemanticConfidence: 0.85,
  semanticToProceduralAccess: 25,
  semanticToProceduralConfidence: 0.95,
};

export class TierConsolidator {
  private readonly knowledgeRepo: KnowledgeRepository;
  private readonly consolidationRepo: ConsolidationRepository;
  private readonly config: ConsolidationConfig;

  constructor(
    knowledgeRepo: KnowledgeRepository,
    consolidationRepo: ConsolidationRepository,
    config = DEFAULT_CONFIG
  ) {
    this.knowledgeRepo = knowledgeRepo;
    this.consolidationRepo = consolidationRepo;
    this.config = config;
  }

  /** Run full consolidation cycle. */
  consolidate(): ConsolidationResult {
    const fixed = this.fixTierMismatches();
    const promoted = this.promoteEligible();
    const expired = this.expireStale();
    return { promoted: promoted + fixed, demoted: 0, expired };
  }

  /** Fix entries whose tier doesn't match their type (legacy data). */
  private fixTierMismatches(): number {
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
  private tierForType(type: string): string {
    switch (type) {
      case 'REQUIREMENT': case 'ARCHITECTURE': case 'PROCEDURE': case 'API_DESIGN':
        return 'SEMANTIC';
      case 'DECISION': case 'LESSON_LEARNED': case 'ERROR_PATTERN':
        return 'EPISODIC';
      default:
        return 'WORKING';
    }
  }

  private promoteEligible(): number {
    let count = 0;
    count += this.promoteFromTier('WORKING', 'EPISODIC',
      this.config.workingToEpisodicAccess, this.config.workingToEpisodicConfidence);
    count += this.promoteFromTier('EPISODIC', 'SEMANTIC',
      this.config.episodicToSemanticAccess, this.config.episodicToSemanticConfidence);
    count += this.promoteFromTier('SEMANTIC', 'PROCEDURAL',
      this.config.semanticToProceduralAccess, this.config.semanticToProceduralConfidence);
    return count;
  }

  private promoteFromTier(from: string, to: string, minAccess: number, minConf: number): number {
    const candidates = this.consolidationRepo.findPromotionCandidates(from, minAccess, minConf);
    for (const id of candidates) {
      this.knowledgeRepo.updateTier(id, to);
      this.consolidationRepo.logTransition(id, from, to, 'auto:threshold_met');
    }
    return candidates.length;
  }

  private expireStale(): number {
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
