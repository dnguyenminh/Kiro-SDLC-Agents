/**
 * KSA-169: Chunker — Split text into overlapping chunks for embedding.
 * Uses token-based splitting with configurable overlap.
 */
export interface Chunk {
    text: string;
    index: number;
    tokenCount: number;
    startOffset: number;
    endOffset: number;
}
export declare class Chunker {
    private maxTokens;
    private overlap;
    constructor(maxTokens?: number, overlap?: number);
    /** Split text into chunks. Returns single chunk if <= maxTokens. */
    chunk(text: string): Chunk[];
    getMaxTokens(): number;
    getOverlap(): number;
}
//# sourceMappingURL=chunker.d.ts.map