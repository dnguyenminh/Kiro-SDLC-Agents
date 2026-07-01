/**
 * AuthManager — orchestrates login/logout, SecretStorage CRUD, state management.
 * Implements TDD §5.2 Extension auth, FSD UC-1, UC-10, §5.5 State Machine.
 */
import * as vscode from 'vscode';
import { AuthState, StoredTokens, LoginResponse, UserProfile } from '../types/auth';
export declare class AuthManager implements vscode.Disposable {
    private readonly secrets;
    private _state;
    private _user;
    private readonly _onStateChange;
    readonly onStateChange: vscode.Event<AuthState>;
    get state(): AuthState;
    get user(): UserProfile | null;
    get isAuthenticated(): boolean;
    constructor(secrets: vscode.SecretStorage);
    /**
     * Initialize — check SecretStorage for existing tokens (UC-1 AF-1).
     */
    initialize(): Promise<void>;
    /**
     * Store tokens after successful login.
     */
    storeLoginResult(response: LoginResponse): Promise<void>;
    /**
     * Store new tokens after refresh.
     */
    storeRefreshResult(accessToken: string, refreshToken: string, expiresIn: number): Promise<void>;
    /**
     * Get stored tokens for HTTP requests.
     */
    getStoredTokens(): Promise<StoredTokens | null>;
    /**
     * Get current access token.
     */
    getAccessToken(): Promise<string | null>;
    /**
     * Get refresh token for renewal.
     */
    getRefreshToken(): Promise<string | null>;
    /**
     * Clear all auth state (logout). Implements UC-10.
     */
    clearTokens(): Promise<void>;
    /**
     * Mark as authenticating (during login flow).
     */
    setAuthenticating(): void;
    /**
     * Mark as refreshing (during token refresh).
     */
    setRefreshing(): void;
    /**
     * Mark as unauthenticated (on 401 or refresh failure).
     */
    setUnauthenticated(): void;
    private setState;
    dispose(): void;
}
