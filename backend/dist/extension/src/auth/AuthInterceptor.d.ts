/**
 * AuthInterceptor — injects Bearer JWT header on all HttpClient requests.
 * Implements TDD §5.2, FSD BR-1 (all requests include Bearer token).
 */
import { AuthManager } from './AuthManager';
export declare class AuthInterceptor {
    private readonly authManager;
    constructor(authManager: AuthManager);
    /**
     * Get headers with Bearer token for authenticated requests.
     * Returns empty object if not authenticated.
     */
    getAuthHeaders(): Promise<Record<string, string>>;
    /**
     * Inject auth headers into existing headers map.
     */
    injectHeaders(headers?: Record<string, string>): Promise<Record<string, string>>;
    /**
     * Check if a response indicates auth failure (401).
     * If so, trigger unauthenticated state.
     */
    handleAuthError(statusCode: number): boolean;
}
