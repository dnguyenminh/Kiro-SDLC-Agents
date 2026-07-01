/**
 * AuthInterceptor — injects Bearer JWT header on all HttpClient requests.
 * Implements TDD §5.2, FSD BR-1 (all requests include Bearer token).
 */
export class AuthInterceptor {
    authManager;
    constructor(authManager) {
        this.authManager = authManager;
    }
    /**
     * Get headers with Bearer token for authenticated requests.
     * Returns empty object if not authenticated.
     */
    async getAuthHeaders() {
        if (!this.authManager.isAuthenticated) {
            return {};
        }
        const token = await this.authManager.getAccessToken();
        if (!token)
            return {};
        return { Authorization: `Bearer ${token}` };
    }
    /**
     * Inject auth headers into existing headers map.
     */
    async injectHeaders(headers = {}) {
        const authHeaders = await this.getAuthHeaders();
        return { ...headers, ...authHeaders };
    }
    /**
     * Check if a response indicates auth failure (401).
     * If so, trigger unauthenticated state.
     */
    handleAuthError(statusCode) {
        if (statusCode === 401) {
            this.authManager.setUnauthenticated();
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=AuthInterceptor.js.map