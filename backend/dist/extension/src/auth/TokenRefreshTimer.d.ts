/**
 * TokenRefreshTimer — auto-refresh access token at (expiry - 5 min).
 * Implements TDD §5.2, FSD UC-3, BR-8.
 */
import * as vscode from 'vscode';
import { AuthManager } from './AuthManager';
export declare class TokenRefreshTimer implements vscode.Disposable {
    private readonly authManager;
    private timer;
    private readonly baseUrl;
    constructor(authManager: AuthManager, baseUrl: string);
    /**
     * Start the refresh timer based on current token expiry.
     */
    start(): Promise<void>;
    /**
     * Stop the refresh timer.
     */
    stop(): void;
    /**
     * Execute token refresh.
     */
    private doRefresh;
    private retryRefresh;
    dispose(): void;
}
