/**
 * AuthManager — orchestrates login/logout, SecretStorage CRUD, state management.
 * Implements TDD §5.2 Extension auth, FSD UC-1, UC-10, §5.5 State Machine.
 */
import * as vscode from 'vscode';
const SECRET_KEY_ACCESS = 'codeIntel.auth.accessToken';
const SECRET_KEY_REFRESH = 'codeIntel.auth.refreshToken';
const SECRET_KEY_EXPIRES = 'codeIntel.auth.expiresAt';
const SECRET_KEY_USER = 'codeIntel.auth.user';
export class AuthManager {
    secrets;
    _state = 'UNAUTHENTICATED';
    _user = null;
    _onStateChange = new vscode.EventEmitter();
    onStateChange = this._onStateChange.event;
    get state() {
        return this._state;
    }
    get user() {
        return this._user;
    }
    get isAuthenticated() {
        return this._state === 'AUTHENTICATED';
    }
    constructor(secrets) {
        this.secrets = secrets;
    }
    /**
     * Initialize — check SecretStorage for existing tokens (UC-1 AF-1).
     */
    async initialize() {
        const accessToken = await this.secrets.get(SECRET_KEY_ACCESS);
        const expiresAtStr = await this.secrets.get(SECRET_KEY_EXPIRES);
        if (accessToken && expiresAtStr) {
            const expiresAt = parseInt(expiresAtStr, 10);
            if (expiresAt > Date.now()) {
                // Token still valid
                const userJson = await this.secrets.get(SECRET_KEY_USER);
                if (userJson) {
                    this._user = JSON.parse(userJson);
                }
                this.setState('AUTHENTICATED');
                return;
            }
        }
        // No valid token — check if refresh available
        const refreshToken = await this.secrets.get(SECRET_KEY_REFRESH);
        if (refreshToken) {
            this.setState('REFRESHING');
        }
        else {
            this.setState('UNAUTHENTICATED');
        }
    }
    /**
     * Store tokens after successful login.
     */
    async storeLoginResult(response) {
        const expiresAt = Date.now() + response.expires_in * 1000;
        await this.secrets.store(SECRET_KEY_ACCESS, response.access_token);
        await this.secrets.store(SECRET_KEY_REFRESH, response.refresh_token);
        await this.secrets.store(SECRET_KEY_EXPIRES, expiresAt.toString());
        this._user = {
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            display_name: response.user.display_name,
            role: response.user.role,
            projects: response.user.projects,
            auth_method: 'local',
        };
        await this.secrets.store(SECRET_KEY_USER, JSON.stringify(this._user));
        this.setState('AUTHENTICATED');
    }
    /**
     * Store new tokens after refresh.
     */
    async storeRefreshResult(accessToken, refreshToken, expiresIn) {
        const expiresAt = Date.now() + expiresIn * 1000;
        await this.secrets.store(SECRET_KEY_ACCESS, accessToken);
        await this.secrets.store(SECRET_KEY_REFRESH, refreshToken);
        await this.secrets.store(SECRET_KEY_EXPIRES, expiresAt.toString());
        this.setState('AUTHENTICATED');
    }
    /**
     * Get stored tokens for HTTP requests.
     */
    async getStoredTokens() {
        const accessToken = await this.secrets.get(SECRET_KEY_ACCESS);
        const refreshToken = await this.secrets.get(SECRET_KEY_REFRESH);
        const expiresAtStr = await this.secrets.get(SECRET_KEY_EXPIRES);
        if (!accessToken || !refreshToken || !expiresAtStr)
            return null;
        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: parseInt(expiresAtStr, 10),
        };
    }
    /**
     * Get current access token.
     */
    async getAccessToken() {
        return await this.secrets.get(SECRET_KEY_ACCESS) ?? null;
    }
    /**
     * Get refresh token for renewal.
     */
    async getRefreshToken() {
        return await this.secrets.get(SECRET_KEY_REFRESH) ?? null;
    }
    /**
     * Clear all auth state (logout). Implements UC-10.
     */
    async clearTokens() {
        await this.secrets.delete(SECRET_KEY_ACCESS);
        await this.secrets.delete(SECRET_KEY_REFRESH);
        await this.secrets.delete(SECRET_KEY_EXPIRES);
        await this.secrets.delete(SECRET_KEY_USER);
        this._user = null;
        this.setState('UNAUTHENTICATED');
    }
    /**
     * Mark as authenticating (during login flow).
     */
    setAuthenticating() {
        this.setState('AUTHENTICATING');
    }
    /**
     * Mark as refreshing (during token refresh).
     */
    setRefreshing() {
        this.setState('REFRESHING');
    }
    /**
     * Mark as unauthenticated (on 401 or refresh failure).
     */
    setUnauthenticated() {
        this.setState('UNAUTHENTICATED');
    }
    setState(state) {
        if (this._state !== state) {
            this._state = state;
            this._onStateChange.fire(state);
        }
    }
    dispose() {
        this._onStateChange.dispose();
    }
}
//# sourceMappingURL=AuthManager.js.map