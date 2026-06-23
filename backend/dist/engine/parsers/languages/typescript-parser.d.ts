/**
 * KSA-146: TypeScript/JavaScript Language Parser (Modular Architecture).
 * Delegates extraction to specialized sub-extractors for maintainability.
 * Supports both TypeScript (.ts/.tsx) and JavaScript (.js/.jsx/.mjs/.cjs).
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class TypeScriptParser implements ILanguageParser {
    readonly languageId: string;
    private parser;
    private symbolExtractor;
    private callExtractor;
    private importExtractor;
    private inheritanceExtractor;
    constructor(parser: any, languageId: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
}
