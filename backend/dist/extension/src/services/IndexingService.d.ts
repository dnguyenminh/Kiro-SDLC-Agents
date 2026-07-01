/**
 * IndexingService — uploads documents and source files to remote backend for indexing.
 * KSA-292: New service (TDD §4.6).
 */
import * as vscode from 'vscode';
import { HttpClient } from '../proxy/HttpClient';
export declare class IndexingService implements vscode.Disposable {
    private readonly client;
    private readonly outputChannel;
    private isIndexing;
    constructor(client: HttpClient, outputChannel: vscode.OutputChannel);
    /**
     * Index all markdown documents in workspace.
     */
    indexDocuments(): Promise<void>;
    /**
     * Index source code files.
     */
    indexSource(): Promise<void>;
    private log;
    dispose(): void;
}
