/**
 * KSA-191: Apex Language Parser.
 * Extracts symbols and relationships from Apex AST using tree-sitter.
 * Supports: classes, interfaces, enums, triggers,
 * methods, constructors, fields, DML, SOQL, imports, inheritance, calls.
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class ApexParser implements ILanguageParser {
    readonly languageId: string;
    private parser;
    constructor(parser: any, languageId: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
    private extractDeclarations;
    private extractType;
    private extractMembers;
    private extractMethod;
    private extractConstructor;
    private extractFields;
    private extractTrigger;
    private extractTriggerEvents;
    private extractDML;
    /** Heuristic: infer SObject name from DML target variable. */
    private inferSObjectFromDML;
    private extractSOQL;
    private extractCalls;
    private resolveCallTarget;
    private extractInheritance;
    private extractModifiers;
    private extractAnnotations;
    private extractMethodReturnType;
    private getFieldType;
    private getBaseTypeName;
    private calculateComplexity;
    private buildMethodSignature;
}
