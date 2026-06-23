/**
 * Query Layer — FTS5 search, symbol lookup, module listing.
 * Provides the data access layer for all MCP tool handlers.
 */
import { DatabaseManager } from '../db/database-manager.js';
export interface SearchResult {
    name: string;
    kind: string;
    signature: string;
    filePath: string;
    startLine: number;
    endLine: number;
    docComment: string | null;
    rank: number;
}
export interface SymbolInfo {
    name: string;
    kind: string;
    signature: string;
    filePath: string;
    startLine: number;
    endLine: number;
    visibility: string | null;
    docComment: string | null;
    parentSymbol: string | null;
}
export interface ModuleInfo {
    name: string;
    rootPath: string;
    language: string | null;
    description: string | null;
    fileCount: number;
    symbolCount: number;
    diStyle: string | null;
    errorHandling: string | null;
    namingConvention: string | null;
    loggingFramework: string | null;
    testingFramework: string | null;
    purpose: string | null;
}
export interface IndexStatus {
    totalFiles: number;
    totalSymbols: number;
    totalModules: number;
    languages: Record<string, number>;
    lastIndexed: string | null;
}
export declare class QueryLayer {
    private db;
    constructor(dbManager: DatabaseManager);
    /** Full-text search across symbols using FTS5. */
    searchCode(query: string, limit?: number): SearchResult[];
    /** Lookup symbols by exact name or prefix. */
    findSymbols(name: string, kind?: string, limit?: number): SymbolInfo[];
    /** Get symbols in a specific file. */
    getFileSymbols(relativePath: string): SymbolInfo[];
    /** List all modules with stats and pattern metadata. */
    listModules(): ModuleInfo[];
    /** List modules with pattern metadata, optionally filtered by name. */
    listModulesWithPatterns(name: string | null): ModuleInfo[];
    /** Get index status and statistics. */
    getIndexStatus(): IndexStatus;
}
