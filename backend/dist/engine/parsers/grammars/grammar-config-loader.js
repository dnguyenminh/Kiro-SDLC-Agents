/**
 * KSA-152: Grammar Configuration Loader.
 * Loads per-language JSON grammar configs and provides a LanguageRegistry.
 */
import * as fs from 'fs';
import * as path from 'path';
const DEFAULT_PARSER_CONFIG = {
    includePrivate: false,
    includeTests: false,
    parseDocs: true,
    maxFileSize: 1_048_576,
    maxFunctionSize: 10_000,
    timeoutPerFile: 5000,
};
export class LanguageRegistry {
    extMap = new Map();
    languages = new Map();
    register(config) {
        this.languages.set(config.language, config);
        for (const ext of config.extensions) {
            this.extMap.set(ext, config);
        }
    }
    getByExtension(ext) {
        return this.extMap.get(ext) ?? null;
    }
    getByName(name) {
        return this.languages.get(name) ?? null;
    }
    listLanguages() {
        return Array.from(this.languages.values()).map(c => ({
            language: c.language,
            displayName: c.displayName,
            extensions: c.extensions,
        }));
    }
    get size() {
        return this.languages.size;
    }
}
export function loadGrammarConfigs(configDir) {
    const registry = new LanguageRegistry();
    if (!fs.existsSync(configDir)) {
        console.error(`[grammar-config] Config directory not found: ${configDir}`);
        return registry;
    }
    const files = fs.readdirSync(configDir).filter(f => f.endsWith('.grammar.json'));
    for (const file of files) {
        try {
            const filePath = path.join(configDir, file);
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const config = parseGrammarConfig(raw);
            if (config) {
                registry.register(config);
                console.error(`[grammar-config] Loaded: ${config.language} (${config.extensions.join(', ')})`);
            }
        }
        catch (err) {
            console.error(`[grammar-config] Failed to load ${file}:`, err);
        }
    }
    return registry;
}
function parseGrammarConfig(raw) {
    if (!raw.language || !raw.extensions || !raw.grammar_wasm || !raw.entities) {
        return null;
    }
    const entities = {};
    if (typeof raw.entities === 'object' && raw.entities) {
        for (const [key, val] of Object.entries(raw.entities)) {
            entities[key] = {
                nodeTypes: val.node_types ?? [],
                nameField: val.name_field ?? 'identifier',
                bodyField: val.body_field,
                kind: val.kind ?? key,
                extractParams: val.extract_params ?? false,
                extractReturnType: val.extract_return_type ?? false,
                extractModifiers: val.extract_modifiers ?? false,
            };
        }
    }
    const relationships = {};
    if (typeof raw.relationships === 'object' && raw.relationships) {
        for (const [key, val] of Object.entries(raw.relationships)) {
            relationships[key] = {
                nodeTypes: val.node_types ?? [],
                kind: val.kind ?? key,
                sourceField: val.source_field,
                targetField: val.target_field,
            };
        }
    }
    const scopingRaw = raw.scoping;
    const scoping = {
        classContainers: scopingRaw?.class_containers ?? ['class_declaration'],
        namespaceContainers: scopingRaw?.namespace_containers ?? ['module', 'namespace_declaration'],
    };
    const parserRaw = raw.parser_config;
    const parserConfig = {
        ...DEFAULT_PARSER_CONFIG,
        ...(parserRaw ? {
            includePrivate: parserRaw.include_private ?? DEFAULT_PARSER_CONFIG.includePrivate,
            includeTests: parserRaw.include_tests ?? DEFAULT_PARSER_CONFIG.includeTests,
            parseDocs: parserRaw.parse_docs ?? DEFAULT_PARSER_CONFIG.parseDocs,
            maxFileSize: parserRaw.max_file_size ?? DEFAULT_PARSER_CONFIG.maxFileSize,
            maxFunctionSize: parserRaw.max_function_size ?? DEFAULT_PARSER_CONFIG.maxFunctionSize,
            timeoutPerFile: parserRaw.timeout_per_file ?? DEFAULT_PARSER_CONFIG.timeoutPerFile,
        } : {}),
    };
    return {
        schemaVersion: String(raw.schema_version ?? '1.0'),
        language: String(raw.language),
        displayName: String(raw.display_name ?? raw.language),
        extensions: raw.extensions,
        grammarWasm: String(raw.grammar_wasm),
        parserConfig,
        entities,
        relationships,
        scoping,
    };
}
export function resolveParserConfig(globalConfig, languageConfig) {
    if (!languageConfig)
        return globalConfig;
    return { ...globalConfig, ...languageConfig };
}
//# sourceMappingURL=grammar-config-loader.js.map