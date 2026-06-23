/**
 * KSA-191: Salesforce Metadata Parser.
 * Extracts symbols and relationships from Salesforce metadata XML files.
 * Supports: Flows, Custom Objects, Fields, LWC metadata, Aura metadata.
 * Uses regex-based XML extraction (no tree-sitter — wasmPath is null).
 */
import type { ILanguageParser, ParseResult } from '../types.js';
export default class SalesforceMetaParser implements ILanguageParser {
    readonly languageId: string;
    constructor(_parser: any, languageId: string);
    getSupportedExtensions(): string[];
    parse(source: string, filePath: string): ParseResult;
    private detectMetaType;
    private parseFlow;
    private parseObject;
    private parseField;
    private parseLWCMeta;
    private parseAuraMeta;
    /** Extract XML element text content by tag name. */
    private extractXmlValues;
    /** Extract XML blocks (multi-line elements). */
    private extractXmlBlocks;
    /** Extract component name from file path. */
    private nameFromPath;
    /** Infer parent object from field path. */
    private inferObjectFromFieldPath;
}
//# sourceMappingURL=salesforce-meta-parser.d.ts.map