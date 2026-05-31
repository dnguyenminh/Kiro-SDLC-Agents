/**
 * SemanticStrategy — vector cosine similarity linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
import { VectorRepository } from '../vector-repo.js';
import type { LinkingStrategy, CandidateEdge } from './types.js';
import type { AutoLinkConfig } from '../auto-link-config.js';
export declare class SemanticStrategy implements LinkingStrategy {
    readonly name = "semantic";
    private readonly vectorRepo;
    constructor(vectorRepo: VectorRepository);
    isEnabled(config: AutoLinkConfig): boolean;
    findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[];
    private cosineSimilarity;
    private bufferToFloat32;
}
//# sourceMappingURL=semantic-strategy.d.ts.map