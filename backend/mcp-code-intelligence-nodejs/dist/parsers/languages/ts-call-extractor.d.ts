/**
 * KSA-146: TypeScript Call Relationship Extractor.
 * Extracts function call relationships and constructor invocations.
 */
import type { SyntaxNode, ExtractedSymbol, ExtractedRelationship } from '../types.js';
export declare class TSCallExtractor {
    extract(rootNode: SyntaxNode, source: string, filePath: string, symbols: ExtractedSymbol[]): ExtractedRelationship[];
    private extractCallsFromBody;
    private resolveCallTarget;
    private resolveMemberExpression;
    private resolveNewTarget;
    private findSymbolNode;
}
//# sourceMappingURL=ts-call-extractor.d.ts.map