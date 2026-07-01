/**
 * WorkspaceSyncService — syncs workspace file tree to remote backend.
 * KSA-292: New service (TDD §4.4).
 * Sends file paths (not content) to backend for workspace awareness.
 */
import * as vscode from 'vscode';
import { HttpClient } from '../proxy/HttpClient';
export interface WorkspaceFileEntry {
    path: string;
    type: 'file' | 'directory';
    size: number;
}
export interface WorkspaceTree {
    workspace_name: string;
    root_path: string;
    files: WorkspaceFileEntry[];
    synced_at: string;
}
export declare class WorkspaceSyncService implements vscode.Disposable {
    private readonly client;
    private readonly outputChannel;
    private watcher;
    private syncDebounceTimer;
    constructor(client: HttpClient, outputChannel: vscode.OutputChannel);
    /**
     * Full sync on connect — send complete workspace tree.
     */
    syncOnConnect(): Promise<void>;
    /**
     * Incremental sync — notify backend of file changes.
     */
    private startWatching;
    private debouncedSync;
    private scanWorkspace;
    private getExcludePattern;
    private log;
    dispose(): void;
}
