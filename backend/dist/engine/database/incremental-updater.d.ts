/**
 * KSA-169: Incremental Updater — Detect file changes using FNV-1a content hashing.
 * Compares disk state against stored file_index to determine what needs re-indexing.
 */
import Database from 'better-sqlite3';
export interface ChangeSet {
    added: string[];
    modified: string[];
    deleted: string[];
    unchanged: number;
}
export declare class IncrementalUpdater {
    private db;
    constructor(db: Database.Database);
    /** Scan workspace and compare against stored file index. */
    scanChanges(files: {
        relativePath: string;
        absolutePath: string;
    }[]): ChangeSet;
    /** Update file index entry after successful indexing. */
    updateFileIndex(relativePath: string, absolutePath: string, symbolCount: number): void;
    /** Remove a file from the index. */
    removeFromIndex(relativePath: string): void;
    /** Get total indexed file count. */
    getIndexedCount(): number;
    private updateMtime;
}
/** FNV-1a 32-bit hash for fast content comparison. */
export declare function fnv1aHash(data: Buffer): string;
