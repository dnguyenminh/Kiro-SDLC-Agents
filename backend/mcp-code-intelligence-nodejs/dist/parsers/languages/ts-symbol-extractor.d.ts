/**
 * KSA-146: TypeScript Symbol Extractor.
 * Extracts functions, classes, interfaces, type aliases, enums, and arrow functions.
 */
import type { SyntaxNode, ExtractedSymbol, ExtractedRelationship } from '../types.js';
export declare class TSSymbolExtractor {
    extract(rootNode: SyntaxNode, source: string, filePath: string, relationships: ExtractedRelationship[]): ExtractedSymbol[];
    private extractFromNode;
    private extractFunction;
    private extractClass;
    private extractClassMembers;
    private extractMethod;
    private extractProperty;
    private extractInterface;
    private extractTypeAlias;
    private extractEnum;
    private extractVariableDeclaration;
}
//# sourceMappingURL=ts-symbol-extractor.d.ts.map