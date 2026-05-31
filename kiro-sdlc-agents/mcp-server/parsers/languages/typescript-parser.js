"use strict";
/**
 * KSA-146: TypeScript/JavaScript Language Parser (Modular Architecture).
 * Delegates extraction to specialized sub-extractors for maintainability.
 * Supports both TypeScript (.ts/.tsx) and JavaScript (.js/.jsx/.mjs/.cjs).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ast_utils_js_1 = require("../ast-utils.js");
const ts_symbol_extractor_js_1 = require("./ts-symbol-extractor.js");
const ts_call_extractor_js_1 = require("./ts-call-extractor.js");
const ts_import_extractor_js_1 = require("./ts-import-extractor.js");
const ts_inheritance_extractor_js_1 = require("./ts-inheritance-extractor.js");
class TypeScriptParser {
    languageId;
    parser; // web-tree-sitter Parser instance
    symbolExtractor;
    callExtractor;
    importExtractor;
    inheritanceExtractor;
    constructor(parser, languageId) {
        this.parser = parser;
        this.languageId = languageId;
        this.symbolExtractor = new ts_symbol_extractor_js_1.TSSymbolExtractor();
        this.callExtractor = new ts_call_extractor_js_1.TSCallExtractor();
        this.importExtractor = new ts_import_extractor_js_1.TSImportExtractor();
        this.inheritanceExtractor = new ts_inheritance_extractor_js_1.TSInheritanceExtractor();
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
            const errorNodes = (0, ast_utils_js_1.findNodes)(rootNode, 'ERROR');
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
exports.default = TypeScriptParser;
//# sourceMappingURL=typescript-parser.js.map