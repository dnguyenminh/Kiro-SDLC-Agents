"use strict";
/**
 * KSA-145: Grammar Registry — Manages tree-sitter WASM grammar loading and caching.
 * Maps file extensions to language parsers, lazy-loads grammars on first use.
 * KSA-191: Added null wasmPath support + compound extension matching.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarRegistry = void 0;
exports.loadGrammarConfig = loadGrammarConfig;
const web_tree_sitter_1 = require("web-tree-sitter");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class GrammarRegistry {
    config;
    parsers = new Map();
    languageParsers = new Map();
    extensionMap = new Map();
    unavailable = new Set();
    initialized = false;
    ParserClass = null;
    constructor(config) {
        this.config = config;
        this.buildExtensionMap();
    }
    /** Initialize web-tree-sitter WASM runtime. Must be called before parsing. */
    async initialize() {
        if (this.initialized)
            return;
        await web_tree_sitter_1.Parser.init();
        this.ParserClass = web_tree_sitter_1.Parser;
        this.initialized = true;
        console.error('[grammar-registry] Tree-sitter WASM runtime initialized');
    }
    /** Get a parser for a file path based on extension. Returns null if unsupported. */
    async getParser(filePath) {
        if (!this.initialized)
            await this.initialize();
        const langId = this.getLanguageId(filePath);
        if (!langId || this.unavailable.has(langId))
            return null;
        if (this.languageParsers.has(langId)) {
            return this.languageParsers.get(langId);
        }
        return this.loadParser(langId);
    }
    /** Get language ID for a file — supports compound extensions (longest match wins). */
    getLanguageId(filePath) {
        const lowerPath = filePath.toLowerCase().replace(/\\/g, '/');
        // Try compound extensions first (longest match wins)
        for (const [ext, langId] of this.extensionMap.entries()) {
            // Compound extensions have multiple dots (e.g., .flow-meta.xml)
            if (ext.split('.').length > 2 && lowerPath.endsWith(ext)) {
                return langId;
            }
        }
        // Fall back to simple extension
        const ext = path.extname(lowerPath);
        return this.extensionMap.get(ext) ?? null;
    }
    /** List all registered languages. */
    listLanguages() {
        return this.config.languages.map(lang => ({
            id: lang.id,
            extensions: lang.extensions,
            available: !this.unavailable.has(lang.id),
        }));
    }
    /** Check if a language grammar is available. */
    isAvailable(langId) {
        return !this.unavailable.has(langId) &&
            this.config.languages.some(l => l.id === langId);
    }
    async loadParser(langId) {
        const langConfig = this.config.languages.find(c => c.id === langId);
        if (!langConfig)
            return null;
        try {
            let parser = null;
            if (langConfig.wasmPath) {
                // Standard tree-sitter path (existing behavior)
                const wasmPath = path.resolve(this.config.grammarDir, langConfig.wasmPath);
                if (!fs.existsSync(wasmPath)) {
                    console.error(`[grammar-registry] WASM not found: ${wasmPath}`);
                    this.unavailable.add(langId);
                    return null;
                }
                parser = new web_tree_sitter_1.Parser();
                const language = await web_tree_sitter_1.Language.load(wasmPath);
                parser.setLanguage(language);
                this.parsers.set(langId, parser);
            }
            // If wasmPath is null, parser stays null — passed to constructor as-is
            // Dynamically import the language parser module
            const modulePath = langConfig.parserModule;
            const imported = await import(modulePath);
            // Handle both ESM default export and CJS module.exports.default
            const LangParserClass = imported.default?.default ?? imported.default ?? imported;
            if (typeof LangParserClass !== 'function') {
                throw new TypeError(`LangParserClass is not a constructor (got ${typeof LangParserClass})`);
            }
            const langParser = new LangParserClass(parser, langId);
            this.languageParsers.set(langId, langParser);
            console.error(`[grammar-registry] Loaded grammar: ${langId}`);
            return langParser;
        }
        catch (error) {
            console.error(`[grammar-registry] Failed to load ${langId}:`, error);
            this.unavailable.add(langId);
            return null;
        }
    }
    buildExtensionMap() {
        // Sort languages so compound extensions (longer) are registered first
        const sorted = [...this.config.languages].sort((a, b) => {
            const maxA = Math.max(...a.extensions.map(e => e.length));
            const maxB = Math.max(...b.extensions.map(e => e.length));
            return maxB - maxA; // Longer extensions first
        });
        for (const lang of sorted) {
            for (const ext of lang.extensions) {
                this.extensionMap.set(ext, lang.id);
            }
        }
    }
}
exports.GrammarRegistry = GrammarRegistry;
/** Load grammar registry config from JSON file. */
function loadGrammarConfig(configPath) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);
    return {
        languages: data.languages ?? [],
        grammarDir: path.dirname(configPath),
    };
}
//# sourceMappingURL=grammar-registry.js.map