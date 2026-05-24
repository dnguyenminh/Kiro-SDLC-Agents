/**
 * Ollama HTTP Client — Communicates with local Ollama API for embeddings.
 * Gracefully degrades if Ollama is not available.
 */
export interface EmbeddingResponse {
    embedding: number[];
}
export interface OllamaConfig {
    url: string;
    model: string;
}
export declare class OllamaClient {
    private url;
    private model;
    private available;
    constructor(config: OllamaConfig);
    /** Check if Ollama is reachable. */
    isAvailable(): Promise<boolean>;
    /** Generate embedding vector for text. */
    generateEmbedding(text: string): Promise<number[] | null>;
    /** Generate embeddings for multiple texts in batch. */
    generateBatch(texts: string[]): Promise<(number[] | null)[]>;
}
//# sourceMappingURL=ollama-client.d.ts.map