"use strict";
/**
 * KSA-146: TypeScript Import/Export Extractor.
 * Extracts import statements, re-exports, and require() calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TSImportExtractor = void 0;
const ast_utils_js_1 = require("../ast-utils.js");
class TSImportExtractor {
    extract(rootNode, source, filePath) {
        const relationships = [];
        // ES module imports
        this.extractImports(rootNode, source, filePath, relationships);
        // require() calls at top level
        this.extractRequires(rootNode, source, filePath, relationships);
        return relationships;
    }
    extractImports(rootNode, source, filePath, relationships) {
        const importNodes = (0, ast_utils_js_1.findNodes)(rootNode, 'import_statement');
        for (const importNode of importNodes) {
            const sourceNode = (0, ast_utils_js_1.getNamedChild)(importNode, 'string');
            if (!sourceNode)
                continue;
            const importPath = (0, ast_utils_js_1.getNodeText)(sourceNode, source).replace(/['"]/g, '');
            const range = (0, ast_utils_js_1.getNodeRange)(importNode);
            const clause = (0, ast_utils_js_1.getNamedChild)(importNode, 'import_clause');
            if (!clause) {
                // Side-effect import: import './styles.css'
                relationships.push({
                    sourceSymbol: filePath,
                    targetSymbol: importPath,
                    kind: 'imports',
                    filePath,
                    line: range.startLine,
                    metadata: { type: 'side-effect', module: importPath },
                });
                continue;
            }
            // Named imports: import { A, B } from '...'
            const namedImports = (0, ast_utils_js_1.getNamedChild)(clause, 'named_imports');
            if (namedImports) {
                for (let i = 0; i < namedImports.namedChildCount; i++) {
                    const spec = namedImports.namedChild(i);
                    if (!spec)
                        continue;
                    const text = (0, ast_utils_js_1.getNodeText)(spec, source);
                    const parts = text.split(/\s+as\s+/);
                    const importedName = parts[0].trim();
                    const alias = parts.length > 1 ? parts[1].trim() : undefined;
                    relationships.push({
                        sourceSymbol: filePath,
                        targetSymbol: importedName,
                        kind: 'imports',
                        filePath,
                        line: range.startLine,
                        metadata: {
                            module: importPath,
                            ...(alias && { alias }),
                        },
                    });
                }
                continue;
            }
            // Default import: import Foo from '...'
            const defaultImport = (0, ast_utils_js_1.getNamedChild)(clause, 'identifier');
            if (defaultImport) {
                relationships.push({
                    sourceSymbol: filePath,
                    targetSymbol: (0, ast_utils_js_1.getNodeText)(defaultImport, source),
                    kind: 'imports',
                    filePath,
                    line: range.startLine,
                    metadata: { module: importPath, default: true },
                });
            }
            // Namespace import: import * as ns from '...'
            const namespaceImport = (0, ast_utils_js_1.getNamedChild)(clause, 'namespace_import');
            if (namespaceImport) {
                const nsName = (0, ast_utils_js_1.getNamedChild)(namespaceImport, 'identifier');
                relationships.push({
                    sourceSymbol: filePath,
                    targetSymbol: nsName ? (0, ast_utils_js_1.getNodeText)(nsName, source) : importPath,
                    kind: 'imports',
                    filePath,
                    line: range.startLine,
                    metadata: { module: importPath, namespace: true },
                });
            }
        }
    }
    extractRequires(rootNode, source, filePath, relationships) {
        const callNodes = (0, ast_utils_js_1.findNodes)(rootNode, 'call_expression');
        for (const call of callNodes) {
            const funcNode = call.child(0);
            if (!funcNode || (0, ast_utils_js_1.getNodeText)(funcNode, source) !== 'require')
                continue;
            const args = (0, ast_utils_js_1.getNamedChild)(call, 'arguments');
            if (!args)
                continue;
            const strArg = (0, ast_utils_js_1.getNamedChild)(args, 'string');
            if (!strArg)
                continue;
            const modulePath = (0, ast_utils_js_1.getNodeText)(strArg, source).replace(/['"]/g, '');
            relationships.push({
                sourceSymbol: filePath,
                targetSymbol: modulePath,
                kind: 'imports',
                filePath,
                line: call.startPosition.row + 1,
                metadata: { module: modulePath, type: 'require' },
            });
        }
    }
}
exports.TSImportExtractor = TSImportExtractor;
//# sourceMappingURL=ts-import-extractor.js.map