/**
 * ChatPanel — AI Chat webview panel with SSE streaming.
 * KSA-292: New panel (TDD §4.5).
 */
import * as vscode from 'vscode';
import { HttpClient } from '../../proxy/HttpClient';
import { AuthManager } from '../../auth/AuthManager';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}
export interface ResolvedContext {
    type: 'file' | 'selection' | 'terminal';
    path?: string;
    content: string;
}
export declare class ChatPanel implements vscode.Disposable {
    private panel;
    private readonly extensionUri;
    private readonly client;
    private readonly authManager;
    private readonly outputChannel;
    private sessionId;
    private messages;
    constructor(client: HttpClient, authManager: AuthManager, extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel);
    show(): void;
    close(): void;
    private handleSendMessage;
    private postToWebview;
    private getHtml;
    private log;
    dispose(): void;
}
