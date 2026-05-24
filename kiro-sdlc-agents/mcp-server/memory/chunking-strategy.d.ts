/**
 * Zero-context chunking strategies for document ingestion.
 */
/** A chunk of text with position metadata. */
export interface TextChunk {
    content: string;
    index: number;
    startOffset: number;
    endOffset: number;
    metadata: Record<string, string>;
}
/** Interface for chunking strategies. */
export interface ChunkingStrategy {
    chunk(text: string, metadata?: Record<string, string>): TextChunk[];
}
/** Fixed-size chunking with overlap. */
export declare class FixedSizeChunker implements ChunkingStrategy {
    private readonly chunkSize;
    private readonly overlap;
    constructor(chunkSize?: number, overlap?: number);
    chunk(text: string, metadata?: Record<string, string>): TextChunk[];
    private splitFixed;
}
/** Semantic chunking — splits on paragraph/section boundaries. */
export declare class SemanticChunker implements ChunkingStrategy {
    private readonly maxChunkSize;
    private readonly minChunkSize;
    constructor(maxChunkSize?: number, minChunkSize?: number);
    chunk(text: string, metadata?: Record<string, string>): TextChunk[];
}
//# sourceMappingURL=chunking-strategy.d.ts.map