/**
 * KSA-149: Java Language Parser.
 * Extracts symbols and relationships from Java AST using tree-sitter.
 * Supports: classes, interfaces, enums, records, annotations,
 * methods, constructors, fields, imports, inheritance, calls.
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class JavaParser implements ILanguageParser {
    readonly languageId: string;
    private parser;
    constructor(parser: any, languageId: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
    private extractPackage;
    private extractImports;
    private extractDeclarations;
    private extractType;
    private extractMembers;
    private extractMethod;
    private extractConstructor;
    private extractFields;
    private extractInheritance;
    private extractCalls;
    private resolveCallTarget;
    private extractModifiers;
    private extractAnnotations;
    private extractMethodReturnType;
    private getFieldType;
    private getBaseTypeName;
    private calculateComplexity;
    private buildMethodSignature;
}
