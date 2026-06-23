/**
 * KSA-151: Rust Language Parser.
 * Extracts symbols and relationships from Rust AST using tree-sitter.
 * Handles: functions (async/unsafe/const), structs, enums, traits, impl blocks,
 * use paths (grouped/nested), derive macros, modules, macro invocations.
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class RustParser implements ILanguageParser {
    readonly languageId: string;
    private parser;
    constructor(parser: any, languageId: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
    private extractFromNode;
    private extractFunction;
    private extractStruct;
    private extractEnum;
    private extractTrait;
    private extractImpl;
    private extractModule;
    private extractTypeAlias;
    private extractConstStatic;
    private extractMacroDefinition;
    private extractUseDeclarations;
    private expandUsePath;
    private extractCalls;
    private extractDerives;
    private extractVisibility;
    private hasVisibilityModifier;
    private extractFunctionModifiers;
    private extractParams;
    private extractReturnType;
    private buildFuncSignature;
}
