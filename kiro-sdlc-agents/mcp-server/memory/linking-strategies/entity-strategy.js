"use strict";
/**
 * EntityStrategy — shared entity Jaccard similarity linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityStrategy = void 0;
class EntityStrategy {
    name = 'entity';
    entityRepo;
    constructor(entityRepo) {
        this.entityRepo = entityRepo;
    }
    isEnabled(config) {
        return config.entity.enabled;
    }
    findCandidates(entryId, config) {
        const myEntities = this.entityRepo.getEntities(entryId);
        if (myEntities.length === 0)
            return [];
        const myEntityNames = new Set(myEntities.map(e => e.entity_name));
        const candidateMap = new Map();
        // Find all entries sharing at least one entity
        for (const entity of myEntities) {
            const otherIds = this.entityRepo.findByEntity(entity.entity_name);
            for (const otherId of otherIds) {
                if (otherId === entryId)
                    continue;
                if (!candidateMap.has(otherId))
                    candidateMap.set(otherId, new Set());
                candidateMap.get(otherId).add(entity.entity_name);
            }
        }
        // Compute Jaccard and filter
        const candidates = [];
        for (const [otherId, sharedNames] of candidateMap) {
            const otherEntities = this.entityRepo.getEntities(otherId);
            const otherNames = new Set(otherEntities.map(e => e.entity_name));
            const union = new Set([...myEntityNames, ...otherNames]);
            const jaccard = sharedNames.size / union.size;
            if (jaccard >= config.entity.minJaccard) {
                candidates.push({
                    targetId: otherId,
                    relation: 'SHARES_ENTITY',
                    score: jaccard,
                    metadata: { shared: [...sharedNames], jaccard },
                });
            }
        }
        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, config.entity.maxEdges);
    }
}
exports.EntityStrategy = EntityStrategy;
//# sourceMappingURL=entity-strategy.js.map