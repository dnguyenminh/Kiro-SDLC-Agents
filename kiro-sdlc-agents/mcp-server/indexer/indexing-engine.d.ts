/**
 * Indexing Engine — Full scan and incremental indexing.
 * Coordinates file scanning, symbol extraction, and database updates.
 */
import { DatabaseManager } from '../db/database-manager.js';
import { AppConfig } from '../config.js';
export declare class IndexingEngine {
    private db;
    private config;
    private watcher;
    private running;
    private indexing;
    constructor(dbManager: DatabaseManager, config: AppConfig);
    /** Start background indexing: full scan then watch. */
    startBackgroundIndexing(): Promise<void>;
    /** Run a full workspace index. */
    runFullIndex(): Promise<void>;
    /** Index a single file (for incremental updates). */
    indexSingleFile(filePath: string): void;
    /** Remove a file from the index. */
    removeFile(filePath: string): void;
    /** Check if indexer is currently running. */
    isRunning(): boolean;
    /** Stop the indexer and file watcher. */
    stop(): void;
    private indexFiles;
    private indexFileSymbols;
    private isFileUnchanged;
    private upsertFile;
    private updateModules;
    private detectAndStorePatterns;
    private startWatcher;
}
//# sourceMappingURL=indexing-engine.d.ts.map