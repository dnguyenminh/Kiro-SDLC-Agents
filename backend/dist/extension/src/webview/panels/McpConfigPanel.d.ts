/**
 * McpConfigPanel — Webview for MCP server configuration (Jira, DrawIO, Export).
 * Implements TDD §5.2 McpConfigWebview, FSD UC-9.
 */
import * as vscode from 'vscode';
import { AuthManager } from '../../auth/AuthManager';
export declare class McpConfigPanel implements vscode.Disposable {
    private readonly extensionUri;
    private panel;
    private readonly baseUrl;
    private readonly authInterceptor;
    private readonly disposables;
    constructor(authManager: AuthManager, extensionUri: vscode.Uri, baseUrl: string);
    show(): void;
    close(): void;
    private handleLoad;
    private handleSave;
    private handleTest;
    private postMessage;
    private getHtml;
    dispose(): void;
}
