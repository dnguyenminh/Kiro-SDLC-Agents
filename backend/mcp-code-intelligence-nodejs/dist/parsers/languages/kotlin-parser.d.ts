/**
 * KSA-147: Kotlin Language Parser.
 * Extracts symbols and relationships from Kotlin AST using tree-sitter.
 * Handles: classes, data classes, sealed classes, objects, companion objects,
 * functions, extension functions, suspend functions, properties, type aliases,
 * imports, inheritance, and call relationships.
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class KotlinParser implements ILanguageParser {
    readonly languageId = "kotlin";
    private parser;
    constructor(parser: any, _languageId?: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
    private extractPackage;
    private extractImports;
    private extractDeclarations;
    private extractClass;
    private extractObject;
    private extractCompanionObjects;
    private extractFunction;
    private extractProperty;
    private extractTypeAlias;
    private extractSupertypes;
    private extractCalls;
    private resolveCallTarget;
    private extractModifiers;
    private getAnnotationNames;
    private extractTypeParameters;
    private extractPrimaryConstructor;
    private extractFunctionParameters;
    private extractReturnType;
    private extractReceiverType;
    private calculateKotlinComplexity;
    private buildFunctionSignature;
    private generateDataClassMembers;
}
//# sourceMappingURL=kotlin-parser.d.ts.map