/**
 * IndexingService — uploads documents and source files to remote backend for indexing.
 * KSA-292: New service (TDD §4.6).
 */
import * as vscode from 'vscode';
export class IndexingService {
    client;
    outputChannel;
    isIndexing = false;
    constructor(client, outputChannel) {
        this.client = client;
        this.outputChannel = outputChannel;
    }
    /**
     * Index all markdown documents in workspace.
     */
    async indexDocuments() {
        if (this.isIndexing) {
            vscode.window.showWarningMessage('Indexing already in progress');
            return;
        }
        this.isIndexing = true;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Indexing Documents',
            cancellable: true,
        }, async (progress, token) => {
            try {
                const mdFiles = await vscode.workspace.findFiles('**/*.md', '{**/node_modules/**,**/.git/**}');
                const total = mdFiles.length;
                let processed = 0;
                for (const file of mdFiles) {
                    if (token.isCancellationRequested)
                        break;
                    const content = await vscode.workspace.fs.readFile(file);
                    const relativePath = vscode.workspace.asRelativePath(file);
                    await this.client.post('/api/index/document', {
                        path: relativePath,
                        content: Buffer.from(content).toString('utf-8'),
                        type: 'markdown',
                    });
                    processed++;
                    progress.report({
                        increment: (1 / total) * 100,
                        message: processed + '/' + total + ' — ' + relativePath,
                    });
                }
                this.log('Indexed ' + processed + '/' + total + ' documents');
                vscode.window.showInformationMessage('Indexed ' + processed + ' documents');
            }
            catch (error) {
                this.log('Indexing failed: ' + error.message);
                vscode.window.showErrorMessage('Document indexing failed: ' + error.message);
            }
            finally {
                this.isIndexing = false;
            }
        });
    }
    /**
     * Index source code files.
     */
    async indexSource() {
        if (this.isIndexing) {
            vscode.window.showWarningMessage('Indexing already in progress');
            return;
        }
        this.isIndexing = true;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Indexing Source Code',
            cancellable: true,
        }, async (progress, token) => {
            try {
                const sourceFiles = await vscode.workspace.findFiles('**/*.{ts,js,kt,java,py,go,rs}', '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**}');
                const total = sourceFiles.length;
                let processed = 0;
                // Batch upload for efficiency
                const batchSize = 20;
                for (let i = 0; i < total; i += batchSize) {
                    if (token.isCancellationRequested)
                        break;
                    const batch = sourceFiles.slice(i, i + batchSize);
                    const entries = await Promise.all(batch.map(async (file) => {
                        const content = await vscode.workspace.fs.readFile(file);
                        return {
                            path: vscode.workspace.asRelativePath(file),
                            content: Buffer.from(content).toString('utf-8'),
                        };
                    }));
                    await this.client.post('/api/index/source', { files: entries });
                    processed += batch.length;
                    progress.report({
                        increment: (batch.length / total) * 100,
                        message: processed + '/' + total + ' files',
                    });
                }
                this.log('Indexed ' + processed + '/' + total + ' source files');
                vscode.window.showInformationMessage('Indexed ' + processed + ' source files');
            }
            catch (error) {
                this.log('Source indexing failed: ' + error.message);
                vscode.window.showErrorMessage('Source indexing failed: ' + error.message);
            }
            finally {
                this.isIndexing = false;
            }
        });
    }
    log(message) {
        this.outputChannel.appendLine('[IndexingService] ' + message);
    }
    dispose() {
        // Nothing to dispose
    }
}
//# sourceMappingURL=IndexingService.js.map