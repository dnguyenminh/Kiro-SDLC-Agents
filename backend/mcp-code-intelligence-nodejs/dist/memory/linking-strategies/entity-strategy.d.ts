/**
 * EntityStrategy — shared entity Jaccard similarity linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
import { EntityRepository } from '../entity-repo.js';
import type { LinkingStrategy, CandidateEdge } from './types.js';
import type { AutoLinkConfig } from '../auto-link-config.js';
export declare class EntityStrategy implements LinkingStrategy {
    readonly name = "entity";
    private readonly entityRepo;
    constructor(entityRepo: EntityRepository);
    isEnabled(config: AutoLinkConfig): boolean;
    findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[];
}
//# sourceMappingURL=entity-strategy.d.ts.map