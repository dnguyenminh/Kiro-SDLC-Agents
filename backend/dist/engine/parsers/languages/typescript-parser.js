/**
 * KSA-146: TypeScript/JavaScript Language Parser (Modular Architecture).
 * Delegates extraction to specialized sub-extractors for maintainability.
 * Supports both TypeScript (.ts/.tsx) and JavaScript (.js/.jsx/.mjs/.cjs).
 */
import { findNodes } from '../ast-utils.js';
import { TSSymbolExtractor } from './ts-symbol-extractor.js';
import { TSCallExtractor } from './ts-call-extractor.js';
import { TSImportExtractor } from './ts-import-extractor.js';
import { TSInheritanceExtractor } from './ts-inheritance-extractor.js';
export default class TypeScriptParser {
    languageId;
    parser; // web-tree-sitter Parser instance
    symbolExtractor;
    callExtractor;
    importExtractor;
    inheritanceExtractor;
    constructor(parser, languageId) {
        this.parser = parser;
        this.languageId = languageId;
        this.symbolExtractor = new TSSymbolExtractor();
        this.callExtractor = new TSCallExtractor();
        this.importExtractor = new TSImportExtractor();
        this.inheritanceExtractor = new TSInheritanceExtractor();
    }
    getSupportedExtensions() {
        return this.languageId === 'typescript'
            ? ['.ts', '.tsx']
            : ['.js', '.jsx', '.mjs', '.cjs'];
    }
    parse(source, filePath) {
        const tree = this.parser.parse(source);
        const rootNode = tree.rootNode;
        // Collect parse errors
        const errors = [];
        if (rootNode.hasError) {
            const errorNodes = findNodes(rootNode, 'ERROR');
            for (const node of errorNodes.slice(0, 10)) {
                errors.push({
                    message: 'Parse error',
                    line: node.startPosition.row + 1,
                    column: node.startPosition.column,
                });
            }
        }
        // Extract symbols (functions, classes, interfaces, etc.)
        const relationships = [];
        const symbols = this.symbolExtractor.extract(rootNode, source, filePath, relationships);
        // Extract call relationships
        const calls = this.callExtractor.extract(rootNode, source, filePath, symbols);
        // Extract import relationships
        const imports = this.importExtractor.extract(rootNode, source, filePath);
        // Extract inheritance relationships
        const inheritance = this.inheritanceExtractor.extract(rootNode, source, filePath, symbols);
        // Merge all relationships
        const allRelationships = [...relationships, ...calls, ...imports, ...inheritance];
        return { symbols, relationships: allRelationships, errors };
    }
}
//# sourceMappingURL=typescript-parser.js.map