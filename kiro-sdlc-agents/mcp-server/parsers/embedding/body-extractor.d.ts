/**
 * KSA-169: Body Extractor — Extract function bodies from tree-sitter AST.
 * Provides full body text for embedding generation.
 */
import type { Tree } from 'web-tree-sitter';
import type { SyntaxNode } from '../types.js';
export interface FunctionBody {
    symbolId: string;
    name: string;
    bodyText: string;
    tokenCount: number;
    startLine: number;
    endLine: number;
}
export declare class BodyExtractor {
    private minBodyLines;
    private maxBodyTokens;
    constructor(minBodyLines?: number, maxBodyTokens?: number);
    extractBody(node: SyntaxNode, source: string): string | null;
    extractAllBodies(tree: Tree, source: string, filePath: string): FunctionBody[];
    private findBodyNode;
    private extractFunctionName;
    private estimateTokens;
    private truncateToTokens;
}
//# sourceMappingURL=body-extractor.d.ts.map