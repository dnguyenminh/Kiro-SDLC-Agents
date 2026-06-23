"use strict";
/**
 * SemanticStrategy — vector cosine similarity linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticStrategy = void 0;
class SemanticStrategy {
    name = 'semantic';
    vectorRepo;
    constructor(vectorRepo) {
        this.vectorRepo = vectorRepo;
    }
    isEnabled(config) {
        return config.semantic.enabled;
    }
    findCandidates(entryId, config) {
        const myVector = this.vectorRepo.getVector(entryId);
        if (!myVector)
            return [];
        const allVectors = this.vectorRepo.findAll();
        const candidates = [];
        for (const record of allVectors) {
            if (record.entry_id === entryId)
                continue;
            const otherVector = this.bufferToFloat32(record.vector);
            if (otherVector.length !== myVector.length)
                continue;
            const score = this.cosineSimilarity(myVector, otherVector);
            if (score >= config.semantic.minScore) {
                candidates.push({
                    targetId: record.entry_id,
                    relation: 'SIMILAR_TO',
                    score,
                    metadata: { method: 'cosine', model: record.model },
                });
            }
        }
        // Sort desc, take top N
        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, config.semantic.maxEdges);
    }
    cosineSimilarity(a, b) {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }
    bufferToFloat32(buf) {
        const floats = [];
        for (let i = 0; i < buf.length; i += 4) {
            floats.push(buf.readFloatLE(i));
        }
        return floats;
    }
}
exports.SemanticStrategy = SemanticStrategy;
//# sourceMappingURL=semantic-strategy.js.map