/**
 * AuthManager — orchestrates login/logout, SecretStorage CRUD, state management.
 * Implements TDD §5.2 Extension auth, FSD UC-1, UC-10, §5.5 State Machine.
 */

import * as vscode from 'vscode';
import { AuthState, StoredTokens, LoginResponse, UserProfile } from '../types/auth';

const SECRET_KEY_ACCESS = 'codeIntel.auth.accessToken';
const SECRET_KEY_REFRESH = 'codeIntel.auth.refreshToken';
const SECRET_KEY_EXPIRES = 'codeIntel.auth.expiresAt';
const SECRET_KEY_USER = 'codeIntel.auth.user';

export class AuthManager implements vscode.Disposable {
  private _state: AuthState = 'UNAUTHENTICATED';
  private _user: UserProfile | null = null;
  private readonly _onStateChange = new vscode.EventEmitter<AuthState>();
  readonly onStateChange = this._onStateChange.event;

  get state(): AuthState {
    return this._state;
  }

  get user(): UserProfile | null {
    return this._user;
  }

  get isAuthenticated(): boolean {
    return this._state === 'AUTHENTICATED';
  }

  constructor(private readonly secrets: vscode.SecretStorage) {}

  /**
   * Initialize — check SecretStorage for existing tokens (UC-1 AF-1).
   */
  async initialize(): Promise<void> {
    const accessToken = await this.secrets.get(SECRET_KEY_ACCESS);
    const expiresAtStr = await this.secrets.get(SECRET_KEY_EXPIRES);

    if (accessToken && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (expiresAt > Date.now()) {
        // Token still valid
        const userJson = await this.secrets.get(SECRET_KEY_USER);
        if (userJson) {
          this._user = JSON.parse(userJson) as UserProfile;
        }
        this.setState('AUTHENTICATED');
        return;
      }
    }

    // No valid token — check if refresh available
    const refreshToken = await this.secrets.get(SECRET_KEY_REFRESH);
    if (refreshToken) {
      this.setState('REFRESHING');
    } else {
      this.setState('UNAUTHENTICATED');
    }
  }

  /**
   * Store tokens after successful login.
   */
  async storeLoginResult(response: LoginResponse): Promise<void> {
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
  async storeRefreshResult(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    const expiresAt = Date.now() + expiresIn * 1000;
    await this.secrets.store(SECRET_KEY_ACCESS, accessToken);
    await this.secrets.store(SECRET_KEY_REFRESH, refreshToken);
    await this.secrets.store(SECRET_KEY_EXPIRES, expiresAt.toString());
    this.setState('AUTHENTICATED');
  }

  /**
   * Get stored tokens for HTTP requests.
   */
  async getStoredTokens(): Promise<StoredTokens | null> {
    const accessToken = await this.secrets.get(SECRET_KEY_ACCESS);
    const refreshToken = await this.secrets.get(SECRET_KEY_REFRESH);
    const expiresAtStr = await this.secrets.get(SECRET_KEY_EXPIRES);

    if (!accessToken || !refreshToken || !expiresAtStr) return null;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: parseInt(expiresAtStr, 10),
    };
  }

  /**
   * Get current access token.
   */
  async getAccessToken(): Promise<string | null> {
    return await this.secrets.get(SECRET_KEY_ACCESS) ?? null;
  }

  /**
   * Get refresh token for renewal.
   */
  async getRefreshToken(): Promise<string | null> {
    return await this.secrets.get(SECRET_KEY_REFRESH) ?? null;
  }

  /**
   * Clear all auth state (logout). Implements UC-10.
   */
  async clearTokens(): Promise<void> {
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
  setAuthenticating(): void {
    this.setState('AUTHENTICATING');
  }

  /**
   * Mark as refreshing (during token refresh).
   */
  setRefreshing(): void {
    this.setState('REFRESHING');
  }

  /**
   * Mark as unauthenticated (on 401 or refresh failure).
   */
  setUnauthenticated(): void {
    this.setState('UNAUTHENTICATED');
  }

  private setState(state: AuthState): void {
    if (this._state !== state) {
      this._state = state;
      this._onStateChange.fire(state);
    }
  }

  dispose(): void {
    this._onStateChange.dispose();
  }
}
