/**
 * KSA-145: Tree-sitter Indexer — Orchestrates file parsing and database storage.
 * Uses tree-sitter for supported languages, falls back to regex extraction.
 */
import Database from 'better-sqlite3';
import { GrammarRegistry } from './grammar-registry.js';
import type { IndexResult } from './types.js';
export declare class TreeSitterIndexer {
    private registry;
    private db;
    private maxFileSize;
    constructor(registry: GrammarRegistry, db: Database.Database, maxFileSize?: number);
    /** Index a single file using tree-sitter or regex fallback. */
    indexFile(filePath: string, relativePath: string): Promise<IndexResult>;
    /** Batch index multiple files. */
    indexFiles(files: {
        absolutePath: string;
        relativePath: string;
    }[]): Promise<IndexResult[]>;
    /** Store parse results in the database atomically. */
    private storeResults;
    private regexFallback;
    /** Store regex-extracted symbols in the database. */
    private storeRegexResults;
    private extToLanguage;
}
//# sourceMappingURL=tree-sitter-indexer.d.ts.map