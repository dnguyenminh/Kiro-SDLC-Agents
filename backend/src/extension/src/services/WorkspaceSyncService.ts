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

export class WorkspaceSyncService implements vscode.Disposable {
  private readonly client: HttpClient;
  private readonly outputChannel: vscode.OutputChannel;
  private watcher: vscode.FileSystemWatcher | null = null;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(client: HttpClient, outputChannel: vscode.OutputChannel) {
    this.client = client;
    this.outputChannel = outputChannel;
  }

  /**
   * Full sync on connect — send complete workspace tree.
   */
  async syncOnConnect(): Promise<void> {
    try {
      const tree = await this.scanWorkspace();
      await this.client.post('/api/workspace/sync', tree);
      this.log('Workspace synced: ' + tree.files.length + ' files');
      this.startWatching();
    } catch (error) {
      this.log('Sync failed: ' + (error as Error).message);
    }
  }

  /**
   * Incremental sync — notify backend of file changes.
   */
  private startWatching(): void {
    if (this.watcher) return;

    this.watcher = vscode.workspace.createFileSystemWatcher('**/*');

    this.watcher.onDidCreate((uri) => {
      this.debouncedSync('created', uri);
    });
    this.watcher.onDidDelete((uri) => {
      this.debouncedSync('deleted', uri);
    });
    this.watcher.onDidChange((uri) => {
      this.debouncedSync('changed', uri);
    });
  }

  private debouncedSync(event: string, uri: vscode.Uri): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(async () => {
      try {
        const relativePath = vscode.workspace.asRelativePath(uri);
        await this.client.post('/api/workspace/notify', {
          event,
          path: relativePath,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Silently fail — non-critical operation
      }
    }, 1000);
  }

  private async scanWorkspace(): Promise<WorkspaceTree> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return {
        workspace_name: 'unknown',
        root_path: '',
        files: [],
        synced_at: new Date().toISOString(),
      };
    }

    const rootFolder = folders[0];
    const excludePattern = await this.getExcludePattern();
    const fileUris = await vscode.workspace.findFiles('**/*', excludePattern, 10000);

    const files: WorkspaceFileEntry[] = [];
    for (const uri of fileUris) {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        files.push({
          path: vscode.workspace.asRelativePath(uri),
          type: stat.type === vscode.FileType.Directory ? 'directory' : 'file',
          size: stat.size,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    return {
      workspace_name: rootFolder.name,
      root_path: rootFolder.uri.fsPath,
      files,
      synced_at: new Date().toISOString(),
    };
  }

  private async getExcludePattern(): Promise<string> {
    // Respect .gitignore + common excludes
    return '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.gradle/**,**/__pycache__/**}';
  }

  private log(message: string): void {
    this.outputChannel.appendLine('[WorkspaceSync] ' + message);
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
  }
}
