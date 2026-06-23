"use strict";
/**
 * AuthManager — Authentication state machine for remote backend.
 * Manages token lifecycle using VS Code SecretStorage (OS keychain).
 *
 * Auth endpoint: /api/admin/auth/login
 * Response format: { token, user, expiresAt }
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = exports.AuthError = void 0;
const vscode = __importStar(require("vscode"));
const TokenRefreshTimer_1 = require("./TokenRefreshTimer");
class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthError";
    }
}
exports.AuthError = AuthError;
const SECRET_ACCESS_TOKEN = "kiroSdlc.accessToken";
const SECRET_REFRESH_TOKEN = "kiroSdlc.refreshToken";
class AuthManager {
    secrets;
    baseUrl;
    state = "UNAUTHENTICATED";
    refreshTimer;
    tokenExpiresAt = null;
    cachedToken = null;
    _onStateChange = new vscode.EventEmitter();
    onStateChange = this._onStateChange.event;
    constructor(secrets, baseUrl) {
        this.secrets = secrets;
        this.baseUrl = baseUrl;
        this.refreshTimer = new TokenRefreshTimer_1.TokenRefreshTimer(this);
    }
    get currentState() {
        return this.state;
    }
    get isAuthenticated() {
        return this.state === "AUTHENTICATED";
    }
    /**
     * Initialize from stored credentials on activation.
     */
    async initialize() {
        const token = await this.secrets.get(SECRET_ACCESS_TOKEN);
        if (token && !this.isExpired()) {
            this.cachedToken = token;
            this.transitionTo("AUTHENTICATED");
            this.refreshTimer.start();
        }
    }
    /**
     * Get current access token synchronously from memory cache.
     */
    getTokenSync() {
        return this.cachedToken || "";
    }
    /**
     * Get current access token (auto-refreshes if near expiry).
     */
    async getAccessToken() {
        if (this.state !== "AUTHENTICATED") {
            return null;
        }
        const token = await this.secrets.get(SECRET_ACCESS_TOKEN);
        if (!token) {
            this.transitionTo("UNAUTHENTICATED");
            return null;
        }
        if (this.isExpired()) {
            await this.refreshToken();
            const refreshed = await this.secrets.get(SECRET_ACCESS_TOKEN);
            this.cachedToken = refreshed ?? null;
            return refreshed ?? null;
        }
        this.cachedToken = token;
        return token;
    }
    /**
     * Login with username/password → backend /api/admin/auth/login.
     * Backend returns: { token, user, expiresAt }
     */
    async login(username, password) {
        this.transitionTo("AUTHENTICATING");
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                this.transitionTo("UNAUTHENTICATED");
                const body = await response.text();
                throw new AuthError(`Login failed (${response.status}): ${body}`);
            }
            const data = await response.json();
            await this.secrets.store(SECRET_ACCESS_TOKEN, data.token);
            await this.secrets.store(SECRET_REFRESH_TOKEN, data.token); // Also store as refresh token
            this.cachedToken = data.token;
            // expiresAt is ISO string — store as epoch ms
            this.tokenExpiresAt = new Date(data.expiresAt).getTime();
            this.transitionTo("AUTHENTICATED");
            this.refreshTimer.start();
        }
        catch (err) {
            this.transitionTo("UNAUTHENTICATED");
            if (err instanceof AuthError) {
                throw err;
            }
            throw new AuthError(`Cannot reach backend: ${err.message}`);
        }
    }
    /**
     * Refresh the access token using refresh endpoint.
     */
    async refreshToken() {
        let refreshToken = await this.secrets.get(SECRET_REFRESH_TOKEN);
        if (!refreshToken) {
            refreshToken = await this.secrets.get(SECRET_ACCESS_TOKEN);
        }
        if (!refreshToken) {
            this.transitionTo("UNAUTHENTICATED");
            return;
        }
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403 || response.status === 400 || response.status === 404) {
                    this.transitionTo("UNAUTHENTICATED");
                }
                return;
            }
            const data = await response.json();
            await this.secrets.store(SECRET_ACCESS_TOKEN, data.token);
            await this.secrets.store(SECRET_REFRESH_TOKEN, data.token); // Keep refresh token in sync
            this.cachedToken = data.token;
            if (data.expiresAt) {
                this.tokenExpiresAt = new Date(data.expiresAt).getTime();
            }
        }
        catch (err) {
            console.warn("Failed to refresh token due to network/server issue. Keeping current session.", err);
        }
    }
    /**
     * Logout — clear all stored tokens.
     */
    async logout() {
        // Retrieve refresh token before clearing it so we can inform the backend.
        const refreshToken = await this.secrets.get(SECRET_REFRESH_TOKEN);
        // Attempt to notify backend about logout. Errors are logged but do not block local cleanup.
        if (refreshToken) {
            try {
                const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: refreshToken }),
                });
                if (!response.ok) {
                    const body = await response.text();
                    console.error(`Logout request failed (${response.status}): ${body}`);
                }
            }
            catch (err) {
                console.error(`Logout request error: ${err.message}`);
            }
        }
        // Perform local cleanup regardless of backend response.
        await this.secrets.delete(SECRET_ACCESS_TOKEN);
        await this.secrets.delete(SECRET_REFRESH_TOKEN);
        this.cachedToken = null;
        this.tokenExpiresAt = null;
        this.refreshTimer.stop();
        this.transitionTo("UNAUTHENTICATED");
    }
    isExpired() {
        if (!this.tokenExpiresAt) {
            return false;
        }
        return Date.now() > this.tokenExpiresAt - 60_000;
    }
    transitionTo(newState) {
        if (this.state === newState) {
            return;
        }
        this.state = newState;
        this._onStateChange.fire(newState);
    }
    dispose() {
        this.refreshTimer.stop();
        this._onStateChange.dispose();
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=AuthManager.js.map