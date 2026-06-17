/**
 * AuthInterceptor — injects Bearer JWT header on all HttpClient requests.
 * Implements TDD §5.2, FSD BR-1 (all requests include Bearer token).
 */

import { AuthManager } from './AuthManager';

export class AuthInterceptor {
  constructor(private readonly authManager: AuthManager) {}

  /**
   * Get headers with Bearer token for authenticated requests.
   * Returns empty object if not authenticated.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.authManager.isAuthenticated) {
      return {};
    }

    const token = await this.authManager.getAccessToken();
    if (!token) return {};

    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Inject auth headers into existing headers map.
   */
  async injectHeaders(headers: Record<string, string> = {}): Promise<Record<string, string>> {
    const authHeaders = await this.getAuthHeaders();
    return { ...headers, ...authHeaders };
  }

  /**
   * Check if a response indicates auth failure (401).
   * If so, trigger unauthenticated state.
   */
  handleAuthError(statusCode: number): boolean {
    if (statusCode === 401) {
      this.authManager.setUnauthenticated();
      return true;
    }
    return false;
  }
}
