/**
 * ToolEmbeddingIndex — pre-computed embedding vectors for all registered tools.
 */
import { UnifiedRegistry } from '../registry/index.js';
export declare class ToolEmbeddingIndex {
    private toolNames;
    private vectors;
    private built;
    get isBuilt(): boolean;
    get toolCount(): number;
    /** Build index by embedding all tool descriptions. */
    build(registry: UnifiedRegistry, embedFn: (text: string) => number[] | null): void;
    /** Find top-k tools by cosine similarity to query vector. */
    search(queryVector: number[], topK?: number): Array<[string, number]>;
    /** Clear the index. */
    clear(): void;
}
//# sourceMappingURL=tool-index.d.ts.map