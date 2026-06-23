/**
 * KSA-146: TypeScript Inheritance/Implements Extractor.
 * Extracts extends and implements relationships from classes and interfaces.
 */
import type { SyntaxNode, ExtractedSymbol, ExtractedRelationship } from '../types.js';
export declare class TSInheritanceExtractor {
    extract(rootNode: SyntaxNode, source: string, filePath: string, symbols: ExtractedSymbol[]): ExtractedRelationship[];
    private findNodeAtLine;
}
//# sourceMappingURL=ts-inheritance-extractor.d.ts.map