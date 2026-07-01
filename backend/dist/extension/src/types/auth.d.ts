/**
 * Auth types for the Extension.
 * Implements TDD §5.2 types/auth.ts, FSD §5.5 Authentication State Machine.
 */
export type AuthState = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED' | 'REFRESHING' | 'LOGGING_OUT';
export interface StoredTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}
export interface UserProfile {
    id: string;
    username: string;
    email: string;
    display_name: string | null;
    role: 'user' | 'admin';
    projects: string[];
    auth_method: 'local' | 'sso';
}
export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    user: {
        id: string;
        username: string;
        email: string;
        display_name: string | null;
        role: 'user' | 'admin';
        projects: string[];
    };
}
export interface TokenPairResponse {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
}
export interface AuthErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
