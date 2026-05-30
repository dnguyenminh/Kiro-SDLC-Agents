/**
 * KSA-148: Python Language Parser.
 * Extracts symbols and relationships from Python AST using tree-sitter.
 * Supports: classes (Protocol, ABC, dataclass), functions (async, decorators),
 * imports (all patterns), type hints, complexity calculation.
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class PythonParser implements ILanguageParser {
    readonly languageId: string;
    private parser;
    constructor(parser: any, languageId: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
    private extractImports;
    private extractModuleName;
    private getImportedIdentifiers;
    private extractDeclarations;
    private extractDecorated;
    private extractFunction;
    private extractClass;
    private extractModuleVariable;
    private extractCalls;
    private getDecorators;
    private extractReturnType;
    private extractDocstring;
    private calculateComplexity;
    private buildFunctionSignature;
}
//# sourceMappingURL=python-parser.d.ts.map