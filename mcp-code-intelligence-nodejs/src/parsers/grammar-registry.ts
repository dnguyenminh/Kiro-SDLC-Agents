/**
 * KSA-145: Grammar Registry — Manages tree-sitter WASM grammar loading and caching.
 * Maps file extensions to language parsers, lazy-loads grammars on first use.
 */

import { Parser, Language } from 'web-tree-sitter';
import type { Node } from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';
import type { ILanguageParser } from './types.js';

export interface LanguageConfig {
  id: string;
  extensions: string[];
  wasmPath: string;
  parserModule: string;
}

export interface GrammarRegistryConfig {
  languages: LanguageConfig[];
  grammarDir: string;
}

export class GrammarRegistry {
  private config: GrammarRegistryConfig;
  private parsers: Map<string, any> = new Map();
  private languageParsers: Map<string, ILanguageParser> = new Map();
  private extensionMap: Map<string, string> = new Map();
  private unavailable: Set<string> = new Set();
  private initialized = false;
  private ParserClass: typeof Parser | null = null;

  constructor(config: GrammarRegistryConfig) {
    this.config = config;
    this.buildExtensionMap();
  }

  /** Initialize web-tree-sitter WASM runtime. Must be called before parsing. */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await Parser.init();
    this.ParserClass = Parser;
    this.initialized = true;
    console.error('[grammar-registry] Tree-sitter WASM runtime initialized');
  }

  /** Get a parser for a file path based on extension. Returns null if unsupported. */
  async getParser(filePath: string): Promise<ILanguageParser | null> {
    if (!this.initialized) await this.initialize();

    const ext = path.extname(filePath).toLowerCase();
    const langId = this.extensionMap.get(ext);

    if (!langId || this.unavailable.has(langId)) return null;

    if (this.languageParsers.has(langId)) {
      return this.languageParsers.get(langId)!;
    }

    return this.loadParser(langId);
  }

  /** Get language ID for a file extension. */
  getLanguageId(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensionMap.get(ext) ?? null;
  }

  /** List all registered languages. */
  listLanguages(): { id: string; extensions: string[]; available: boolean }[] {
    return this.config.languages.map(lang => ({
      id: lang.id,
      extensions: lang.extensions,
      available: !this.unavailable.has(lang.id),
    }));
  }

  /** Check if a language grammar is available. */
  isAvailable(langId: string): boolean {
    return !this.unavailable.has(langId) &&
      this.config.languages.some(l => l.id === langId);
  }

  private async loadParser(langId: string): Promise<ILanguageParser | null> {
    const langConfig = this.config.languages.find(c => c.id === langId);
    if (!langConfig) return null;

    try {
      const wasmPath = path.resolve(this.config.grammarDir, langConfig.wasmPath);

      if (!fs.existsSync(wasmPath)) {
        console.error(`[grammar-registry] WASM not found: ${wasmPath}`);
        this.unavailable.add(langId);
        return null;
      }

      const parser = new Parser();
      const language = await Language.load(wasmPath);
      parser.setLanguage(language);
      this.parsers.set(langId, parser);

      // Dynamically import the language parser module
      const modulePath = langConfig.parserModule;
      const { default: LangParserClass } = await import(modulePath);
      const langParser: ILanguageParser = new LangParserClass(parser, langId);
      this.languageParsers.set(langId, langParser);

      console.error(`[grammar-registry] Loaded grammar: ${langId}`);
      return langParser;
    } catch (error) {
      console.error(`[grammar-registry] Failed to load ${langId}:`, error);
      this.unavailable.add(langId);
      return null;
    }
  }

  private buildExtensionMap(): void {
    for (const lang of this.config.languages) {
      for (const ext of lang.extensions) {
        this.extensionMap.set(ext, lang.id);
      }
    }
  }
}

/** Load grammar registry config from JSON file. */
export function loadGrammarConfig(configPath: string): GrammarRegistryConfig {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const data = JSON.parse(raw);
  return {
    languages: data.languages ?? [],
    grammarDir: path.dirname(configPath),
  };
}
