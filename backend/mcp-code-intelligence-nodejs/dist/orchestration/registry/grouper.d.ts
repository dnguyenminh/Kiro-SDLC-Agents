/**
 * Semantic grouper — builds fallback chains by grouping tools with similar functionality.
 * Two strategies: exact name match + Jaccard description similarity.
 * Behavioral parity with Kotlin SemanticGrouper.kt.
 */
export interface RegisteredTool {
    name: string;
    definition: Record<string, any>;
    source: string;
    priority: number;
    nameTokens: Set<string>;
    descTokens: Set<string>;
}
export interface ChainEntry {
    serverName: string;
    priority: number;
    toolName: string | null;
}
export interface ToolChain {
    toolName: string;
    entries: ChainEntry[];
    groupingReason: string;
    similarNames: Set<string>;
}
export declare class SemanticGrouper {
    private threshold;
    constructor(threshold?: number);
    /** Build all chains from registered tools. */
    buildChains(tools: RegisteredTool[]): Map<string, ToolChain>;
    /** Weighted Jaccard similarity between two tools. */
    computeSimilarity(a: RegisteredTool, b: RegisteredTool): number;
    private buildExactNameChains;
    private buildSemanticChains;
    private mergeIntoChain;
}
//# sourceMappingURL=grouper.d.ts.map