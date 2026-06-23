/**
 * Indexing Engine — Full scan and incremental indexing.
 * Coordinates file scanning, symbol extraction, and database updates.
 * KSA-145: Uses TreeSitterIndexer for AST-based parsing with regex fallback.
 */
import { DatabaseManager } from '../db/database-manager.js';
import { AppConfig } from '../config.js';
export declare class IndexingEngine {
    private db;
    private config;
    private watcher;
    private running;
    private indexing;
    private treeSitterIndexer;
    private grammarRegistry;
    private graphRepo;
    private treeSitterReady;
    constructor(dbManager: DatabaseManager, config: AppConfig);
    /** Initialize tree-sitter infrastructure (grammar registry + indexer). */
    private initTreeSitter;
    /** Start background indexing: full scan then watch. */
    startBackgroundIndexing(): Promise<void>;
    /** Run a full workspace index. */
    runFullIndex(): Promise<void>;
    /** KSA-191: Get SFDX project stats from database. */
    getSfdxStats(): {
        detected: boolean;
        projectRoot: string | null;
        packageDirectories: string[];
        stats: {
            apex_classes: number;
            apex_triggers: number;
            flows: number;
            objects: number;
            lwc_components: number;
        };
        lastIndexed: string | null;
        relationships: Record<string, number>;
    } | null;
    /** KSA-191: Log SFDX-specific stats after indexing. */
    private logSfdxStats;
    /** Index a single file (for incremental updates). */
    indexSingleFile(filePath: string): Promise<void>;
    /** Remove a file from the index. */
    removeFile(filePath: string): void;
    /** Check if indexer is currently running. */
    isRunning(): boolean;
    /** Stop the indexer and file watcher. */
    stop(): void;
    /** Get tree-sitter indexer stats. */
    getTreeSitterStats(): {
        ready: boolean;
        languages: string[];
        unavailableGrammars: string[];
    };
    private indexFiles;
    /** Legacy regex-based symbol extraction (used when tree-sitter unavailable). */
    private indexFileSymbolsRegex;
    private isFileUnchanged;
    private upsertFile;
    private updateModules;
    private detectAndStorePatterns;
    /** Detect SFDX project structure. */
    private detectSfdxProject;
    private startWatcher;
}
//# sourceMappingURL=indexing-engine.d.ts.map