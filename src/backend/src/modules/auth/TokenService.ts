/**
 * TokenService — JWT generation, verification, and refresh token management.
 * Implements TDD §5.2, FSD BR-2 (HS256, 1h), BR-3 (refresh 7d).
 * Uses jose library for JWT operations.
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import { AuthPayload, TokenPair } from './types';

const ACCESS_TOKEN_EXPIRY = '1h';   // BR-2
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // BR-3

export class TokenService {
  private readonly secretKey: Uint8Array;

  constructor(jwtSecret: string) {
    this.secretKey = new TextEncoder().encode(jwtSecret);
  }

  /**
   * Generate a JWT access token (HS256, 1h expiry).
   */
  async generateAccessToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
    const jwt = await new SignJWT({
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      projects: payload.projects,
    } as unknown as JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .setSubject(payload.userId)
      .sign(this.secretKey);

    return jwt;
  }

  /**
   * Generate a cryptographically random refresh token.
   * Format: rt_{hex}
   */
  generateRefreshToken(): string {
    return `rt_${randomBytes(32).toString('hex')}`;
  }

  /**
   * SHA-256 hash of a refresh token for storage (never store plaintext).
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Compute refresh token expiry date.
   */
  getRefreshTokenExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    return expiry;
  }

  /**
   * Verify and decode a JWT access token.
   * Throws if invalid or expired.
   */
  async verifyAccessToken(token: string): Promise<AuthPayload> {
    const { payload } = await jwtVerify(token, this.secretKey);

    return {
      userId: payload.userId as string,
      username: payload.username as string,
      email: payload.email as string,
      role: payload.role as 'user' | 'admin',
      projects: payload.projects as string[],
      iat: payload.iat!,
      exp: payload.exp!,
    };
  }

  /**
   * Generate a full token pair (access + refresh).
   */
  async generateTokenPair(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<TokenPair> {
    const access_token = await this.generateAccessToken(payload);
    const refresh_token = this.generateRefreshToken();

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }
}
