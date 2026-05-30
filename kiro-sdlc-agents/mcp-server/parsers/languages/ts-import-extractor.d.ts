/**
 * KSA-146: TypeScript Import/Export Extractor.
 * Extracts import statements, re-exports, and require() calls.
 */
import type { SyntaxNode, ExtractedRelationship } from '../types.js';
export declare class TSImportExtractor {
    extract(rootNode: SyntaxNode, source: string, filePath: string): ExtractedRelationship[];
    private extractImports;
    private extractRequires;
}
//# sourceMappingURL=ts-import-extractor.d.ts.map