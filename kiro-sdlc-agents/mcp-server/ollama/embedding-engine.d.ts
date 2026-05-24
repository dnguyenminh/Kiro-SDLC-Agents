/**
 * Embedding Engine — Generate, store, and search embeddings via Ollama.
 * Optional component: gracefully skips if Ollama unavailable.
 */
import { DatabaseManager } from '../db/database-manager.js';
import { OllamaClient } from './ollama-client.js';
export declare class EmbeddingEngine {
    private db;
    private client;
    private enabled;
    constructor(dbManager: DatabaseManager, client: OllamaClient);
    /** Initialize and check if embeddings are available. */
    initialize(): Promise<void>;
    /** Generate and store embedding for a symbol. */
    embedSymbol(symbolId: number, text: string, model: string): Promise<void>;
    /** Semantic search using cosine similarity. */
    searchSimilar(queryVector: number[], limit?: number): SimilarResult[];
    /** Check if embedding engine is active. */
    isEnabled(): boolean;
    private storeEmbedding;
}
interface SimilarResult {
    symbolId: number;
    fileId: number;
    score: number;
}
export {};
//# sourceMappingURL=embedding-engine.d.ts.map