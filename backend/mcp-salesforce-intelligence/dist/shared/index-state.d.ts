/**
 * Index state persistence — tracks file hashes for incremental indexing.
 * Stored as .sf-index-state.json in the project root.
 */
import type { IndexState, MetadataType, ChangeSet, FileInfo } from './types.js';
export declare class IndexStateManager {
    private statePath;
    private state;
    constructor(projectRoot: string);
    /** Load state from disk. Returns empty state if file missing or corrupted. */
    load(): IndexState;
    /** Save current state to disk */
    save(): void;
    /** Compare current files against stored hashes to find changes */
    getChangedFiles(currentFiles: FileInfo[]): ChangeSet;
    /** Update hash entry for a single file */
    updateFileHash(filePath: string, hash: string, type: MetadataType, name: string): void;
    /** Remove a file from state */
    removeFile(filePath: string): void;
    /** Get current state */
    getState(): IndexState;
    /** Reset state to empty */
    reset(projectPath: string): void;
    private createEmpty;
}
//# sourceMappingURL=index-state.d.ts.map