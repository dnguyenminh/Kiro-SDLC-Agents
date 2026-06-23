/**
 * AuthService — business logic for authentication.
 * Implements TDD §5.2, FSD UC-1, UC-2, UC-3, UC-10.
 * Handles login, token refresh, logout, account lockout (BR-4).
 */
import { UserRepository } from './UserRepository';
import { SessionRepository } from './SessionRepository';
import { TokenService } from './TokenService';
import { PasswordService } from './PasswordService';
import { LoginResponse, TokenPair, AuthPayload } from './types';
export declare class AuthService {
    private readonly userRepo;
    private readonly sessionRepo;
    private readonly tokenService;
    private readonly passwordService;
    constructor(userRepo: UserRepository, sessionRepo: SessionRepository, tokenService: TokenService, passwordService: PasswordService);
    /**
     * Local login with username/password.
     * Implements UC-1, BR-4, BR-5.
     */
    login(username: string, password: string, userAgent?: string): Promise<LoginResponse>;
    /**
     * Refresh access token using valid refresh token.
     * Implements UC-3, BR-3.
     */
    refresh(refreshToken: string): Promise<TokenPair>;
    /**
     * Logout — revoke refresh token server-side.
     * Implements UC-10, BR-18.
     */
    logout(refreshToken: string): void;
    /**
     * Verify JWT and return payload.
     */
    verifyToken(token: string): Promise<AuthPayload>;
    private toPublicUser;
}
/**
 * Custom auth error with HTTP status code.
 */
export declare class AuthError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown> | undefined);
}
//# sourceMappingURL=AuthService.d.ts.map