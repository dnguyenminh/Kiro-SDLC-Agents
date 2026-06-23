/**
 * KSA-145: Grammar Registry — Manages tree-sitter WASM grammar loading and caching.
 * Maps file extensions to language parsers, lazy-loads grammars on first use.
 * KSA-191: Added null wasmPath support + compound extension matching.
 */
import type { ILanguageParser } from './types.js';
export interface LanguageConfig {
    id: string;
    extensions: string[];
    wasmPath: string | null;
    parserModule: string;
}
export interface GrammarRegistryConfig {
    languages: LanguageConfig[];
    grammarDir: string;
}
export declare class GrammarRegistry {
    private config;
    private parsers;
    private languageParsers;
    private extensionMap;
    private unavailable;
    private initialized;
    private ParserClass;
    constructor(config: GrammarRegistryConfig);
    /** Initialize web-tree-sitter WASM runtime. Must be called before parsing. */
    initialize(): Promise<void>;
    /** Get a parser for a file path based on extension. Returns null if unsupported. */
    getParser(filePath: string): Promise<ILanguageParser | null>;
    /** Get language ID for a file — supports compound extensions (longest match wins). */
    getLanguageId(filePath: string): string | null;
    /** List all registered languages. */
    listLanguages(): {
        id: string;
        extensions: string[];
        available: boolean;
    }[];
    /** Check if a language grammar is available. */
    isAvailable(langId: string): boolean;
    private loadParser;
    private buildExtensionMap;
}
/** Load grammar registry config from JSON file. */
export declare function loadGrammarConfig(configPath: string): GrammarRegistryConfig;
