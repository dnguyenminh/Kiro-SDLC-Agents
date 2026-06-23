export declare class EmbeddingService {
    private static instance;
    private extractorPromise;
    private readonly modelName;
    private constructor();
    static getInstance(): EmbeddingService;
    /**
     * Initialize the pipeline. This downloads the model on first run.
     */
    private getExtractor;
    /**
     * Generates a dense vector embedding for the given text.
     */
    generateEmbedding(text: string): Promise<number[]>;
    /**
     * Calculates cosine similarity between two vectors.
     */
    cosineSimilarity(a: number[], b: number[]): number;
}
