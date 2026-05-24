/**
 * EmbeddingService — coordinates embedding generation and storage.
 * Wraps provider + vector repo for embed-and-store workflow.
 */
import { EmbeddingProvider } from './provider.js';
import { VectorRepository } from '../vector-repo.js';
export declare class EmbeddingService {
    private readonly provider;
    private readonly vectorRepo;
    constructor(provider: EmbeddingProvider, vectorRepo: VectorRepository);
    /** Generate and store embedding for a knowledge entry. */
    embedAndStore(entryId: number, text: string): Promise<boolean>;
    /** Embed multiple entries. Returns count of successes. */
    embedBatchAndStore(entries: Array<[number, string]>): Promise<number>;
    /** Get raw embedding for text (without storing). */
    embed(text: string): Promise<number[] | null>;
    /** Check if embedding provider is available. */
    isAvailable(): boolean;
    /** Release resources. */
    close(): void;
    /** Cosine similarity between two vectors. */
    static cosineSimilarity(a: number[], b: number[]): number;
}
/** Convert float array to little-endian Buffer (Float32). */
export declare function floatListToBytes(arr: number[]): Buffer;
/** Convert little-endian Buffer back to float array. */
export declare function bytesToFloatList(data: Buffer): number[];
//# sourceMappingURL=service.d.ts.map