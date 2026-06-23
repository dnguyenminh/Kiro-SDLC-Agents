/**
 * KSA-150: Go Language Parser.
 * Extracts symbols and relationships from Go AST using tree-sitter.
 * Handles: functions, methods (with receivers), structs, interfaces,
 * goroutines, defer, implicit interface implementation detection.
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class GoParser implements ILanguageParser {
    readonly languageId: string;
    private parser;
    constructor(parser: any, languageId: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
    private isGeneratedFile;
    private extractDeclarations;
    private extractFunction;
    private extractMethod;
    private extractTypeDeclaration;
    private extractTypeSpec;
    private extractVarConst;
    private extractImports;
    private extractCalls;
    private isInsideNodeType;
    private detectInterfaceImplementations;
    private extractReceiver;
    private extractParams;
    private extractResult;
    private isExported;
    private buildFuncSignature;
    private buildMethodSignature;
}
//# sourceMappingURL=go-parser.d.ts.map