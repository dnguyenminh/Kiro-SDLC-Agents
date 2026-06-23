/**
 * KSA-152: Grammar Configuration Loader.
 * Loads per-language JSON grammar configs and provides a LanguageRegistry.
 */
export interface EntityConfig {
    nodeTypes: string[];
    nameField: string;
    bodyField?: string;
    kind: string;
    extractParams?: boolean;
    extractReturnType?: boolean;
    extractModifiers?: boolean;
}
export interface RelationshipConfig {
    nodeTypes: string[];
    kind: string;
    sourceField?: string;
    targetField?: string;
}
export interface ScopingConfig {
    classContainers: string[];
    namespaceContainers: string[];
}
export interface ParserConfig {
    includePrivate: boolean;
    includeTests: boolean;
    parseDocs: boolean;
    maxFileSize: number;
    maxFunctionSize: number;
    timeoutPerFile: number;
}
export interface GrammarConfig {
    schemaVersion: string;
    language: string;
    displayName: string;
    extensions: string[];
    grammarWasm: string;
    parserConfig: ParserConfig;
    entities: Record<string, EntityConfig>;
    relationships: Record<string, RelationshipConfig>;
    scoping: ScopingConfig;
}
export declare class LanguageRegistry {
    private extMap;
    private languages;
    register(config: GrammarConfig): void;
    getByExtension(ext: string): GrammarConfig | null;
    getByName(name: string): GrammarConfig | null;
    listLanguages(): {
        language: string;
        displayName: string;
        extensions: string[];
    }[];
    get size(): number;
}
export declare function loadGrammarConfigs(configDir: string): LanguageRegistry;
export declare function resolveParserConfig(globalConfig: ParserConfig, languageConfig?: Partial<ParserConfig>): ParserConfig;
