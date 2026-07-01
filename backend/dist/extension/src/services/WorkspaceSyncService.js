/**
 * WorkspaceSyncService — syncs workspace file tree to remote backend.
 * KSA-292: New service (TDD §4.4).
 * Sends file paths (not content) to backend for workspace awareness.
 */
import * as vscode from 'vscode';
export class WorkspaceSyncService {
    client;
    outputChannel;
    watcher = null;
    syncDebounceTimer = null;
    constructor(client, outputChannel) {
        this.client = client;
        this.outputChannel = outputChannel;
    }
    /**
     * Full sync on connect — send complete workspace tree.
     */
    async syncOnConnect() {
        try {
            const tree = await this.scanWorkspace();
            await this.client.post('/api/workspace/sync', tree);
            this.log('Workspace synced: ' + tree.files.length + ' files');
            this.startWatching();
        }
        catch (error) {
            this.log('Sync failed: ' + error.message);
        }
    }
    /**
     * Incremental sync — notify backend of file changes.
     */
    startWatching() {
        if (this.watcher)
            return;
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
    debouncedSync(event, uri) {
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
            }
            catch {
                // Silently fail — non-critical operation
            }
        }, 1000);
    }
    async scanWorkspace() {
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
        const files = [];
        for (const uri of fileUris) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                files.push({
                    path: vscode.workspace.asRelativePath(uri),
                    type: stat.type === vscode.FileType.Directory ? 'directory' : 'file',
                    size: stat.size,
                });
            }
            catch {
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
    async getExcludePattern() {
        // Respect .gitignore + common excludes
        return '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.gradle/**,**/__pycache__/**}';
    }
    log(message) {
        this.outputChannel.appendLine('[WorkspaceSync] ' + message);
    }
    dispose() {
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = null;
        }
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }
    }
}
//# sourceMappingURL=WorkspaceSyncService.js.map