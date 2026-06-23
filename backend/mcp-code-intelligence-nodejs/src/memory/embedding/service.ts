/**
 * EmbeddingService — coordinates embedding generation and storage.
 * Wraps provider + vector repo for embed-and-store workflow.
 */

import { EmbeddingProvider } from './provider.js';
import { VectorRepository } from '../vector-repo.js';

export class EmbeddingService {
  private readonly provider: EmbeddingProvider;
  private readonly vectorRepo: VectorRepository;

  constructor(provider: EmbeddingProvider, vectorRepo: VectorRepository) {
    this.provider = provider;
    this.vectorRepo = vectorRepo;
  }

  /** Generate and store embedding for a knowledge entry. */
  async embedAndStore(entryId: number, text: string): Promise<boolean> {
    const vector = await this.provider.embed(text);
    if (!vector) return false;
    const blob = floatListToBytes(vector);
    this.vectorRepo.upsert(entryId, blob, this.provider.modelName, this.provider.dimensions);
    return true;
  }

  /** Embed multiple entries. Returns count of successes. */
  async embedBatchAndStore(entries: Array<[number, string]>): Promise<number> {
    let count = 0;
    for (const [entryId, text] of entries) {
      if (await this.embedAndStore(entryId, text)) count++;
    }
    return count;
  }

  /** Get raw embedding for text (without storing). */
  async embed(text: string): Promise<number[] | null> {
    return this.provider.embed(text);
  }

  /** Check if embedding provider is available. */
  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  /** Release resources. */
  close(): void {
    this.provider.close();
  }

  /** Cosine similarity between two vectors. */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0.0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0.0;
  }
}

/** Convert float array to little-endian Buffer (Float32). */
export function floatListToBytes(arr: number[]): Buffer {
  const buf = Buffer.alloc(arr.length * 4);
  for (let i = 0; i < arr.length; i++) {
    buf.writeFloatLE(arr[i], i * 4);
  }
  return buf;
}

/** Convert little-endian Buffer back to float array. */
export function bytesToFloatList(data: Buffer): number[] {
  const count = data.length / 4;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(data.readFloatLE(i * 4));
  }
  return result;
}
