/**
 * TokenService — JWT generation, verification, and refresh token management.
 * Implements TDD §5.2, FSD BR-2 (HS256, 1h), BR-3 (refresh 7d).
 * Uses jose library for JWT operations.
 */
import { AuthPayload, TokenPair } from './types';
export declare class TokenService {
    private readonly secretKey;
    constructor(jwtSecret: string);
    /**
     * Generate a JWT access token (HS256, 1h expiry).
     */
    generateAccessToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string>;
    /**
     * Generate a cryptographically random refresh token.
     * Format: rt_{hex}
     */
    generateRefreshToken(): string;
    /**
     * SHA-256 hash of a refresh token for storage (never store plaintext).
     */
    hashRefreshToken(token: string): string;
    /**
     * Compute refresh token expiry date.
     */
    getRefreshTokenExpiry(): Date;
    /**
     * Verify and decode a JWT access token.
     * Throws if invalid or expired.
     */
    verifyAccessToken(token: string): Promise<AuthPayload>;
    /**
     * Generate a full token pair (access + refresh).
     */
    generateTokenPair(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<TokenPair>;
}
//# sourceMappingURL=TokenService.d.ts.map