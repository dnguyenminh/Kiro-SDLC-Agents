/**
 * SemanticStrategy — vector cosine similarity linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */

import { VectorRepository } from '../vector-repo.js';
import type { LinkingStrategy, CandidateEdge } from './types.js';
import type { AutoLinkConfig } from '../auto-link-config.js';

export class SemanticStrategy implements LinkingStrategy {
  readonly name = 'semantic';
  private readonly vectorRepo: VectorRepository;

  constructor(vectorRepo: VectorRepository) {
    this.vectorRepo = vectorRepo;
  }

  isEnabled(config: AutoLinkConfig): boolean {
    return config.semantic.enabled;
  }

  findCandidates(entryId: number, config: AutoLinkConfig): CandidateEdge[] {
    const myVector = this.vectorRepo.getVector(entryId);
    if (!myVector) return [];

    const allVectors = this.vectorRepo.findAll();
    const candidates: CandidateEdge[] = [];

    for (const record of allVectors) {
      if (record.entry_id === entryId) continue;
      const otherVector = this.bufferToFloat32(record.vector);
      if (otherVector.length !== myVector.length) continue;
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

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private bufferToFloat32(buf: Buffer): number[] {
    const floats: number[] = [];
    for (let i = 0; i < buf.length; i += 4) {
      floats.push(buf.readFloatLE(i));
    }
    return floats;
  }
}
