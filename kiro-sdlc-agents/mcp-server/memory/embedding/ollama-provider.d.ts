/**
 * Ollama-backed embedding provider — wraps HTTP calls to Ollama API.
 * Uses /api/embeddings endpoint for text-to-vector conversion.
 */
import { EmbeddingProvider } from './provider.js';
/** Minimal Ollama client interface for embedding. */
export interface OllamaClient {
    getEmbedding(text: string): Promise<number[] | null>;
    isAvailable(): boolean;
}
export declare class OllamaEmbeddingProvider implements EmbeddingProvider {
    private readonly client;
    private readonly model;
    constructor(client: OllamaClient, model: string);
    get modelName(): string;
    get dimensions(): number;
    embed(text: string): Promise<number[] | null>;
    embedBatch(texts: string[]): Promise<Array<number[] | null>>;
    isAvailable(): boolean;
    close(): void;
}
//# sourceMappingURL=ollama-provider.d.ts.map