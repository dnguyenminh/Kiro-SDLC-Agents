/**
 * LoginPanel — Webview for username/password login + SSO button.
 * Implements TDD §5.2 LoginWebview, FSD UC-1, UC-2.
 */
import * as vscode from 'vscode';
import { AuthManager } from '../../auth/AuthManager';
export declare class LoginPanel implements vscode.Disposable {
    private readonly authManager;
    private readonly extensionUri;
    private panel;
    private readonly baseUrl;
    private readonly disposables;
    constructor(authManager: AuthManager, extensionUri: vscode.Uri, baseUrl: string);
    /**
     * Show the Login Webview panel.
     */
    show(): void;
    /**
     * Close the Login panel.
     */
    close(): void;
    private handleLogin;
    private handleSso;
    private postMessage;
    private getHtml;
    dispose(): void;
}
