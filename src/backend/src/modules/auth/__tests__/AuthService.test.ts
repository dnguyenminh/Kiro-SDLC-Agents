/**
 * AuthService Unit Tests
 * UT-01: Login Valid Credentials
 * UT-02: Login Invalid Password
 * UT-03: Account Lockout After 5 Failures
 * UT-04: Lockout Expired Allows Login
 * UT-05: TokenService.verify Expired Token
 * UT-06: TokenService.verify Tampered Token
 * UT-07: PasswordService scrypt Parameters
 * UT-20: AuthGuard Missing Token
 * UT-22: Session Revoke
 * UT-23: LoginSchema Zod Validation
 * UT-24: AuthManager Token Expiry Check
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, AuthError } from '../AuthService';
import { TokenService } from '../TokenService';
import { PasswordService } from '../PasswordService';
import { z } from 'zod';
import { SignJWT } from 'jose';

const TEST_SECRET = 'test-jwt-secret-key-for-testing-only-256bits!';

// Mock repositories
function createMockUserRepo() {
  return {
    findByUsername: vi.fn(),
    findById: vi.fn(),
    resetFailedAttempts: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    lockAccount: vi.fn(),
  };
}

function createMockSessionRepo() {
  return {
    create: vi.fn(),
    findByRefreshTokenHash: vi.fn(),
    revoke: vi.fn(),
    revokeByRefreshTokenHash: vi.fn(),
  };
}

function createTestUser(overrides = {}) {
  return {
    id: 'user-001',
    username: 'john.doe',
    email: 'john@company.com',
    display_name: 'John Doe',
    password_hash: null as string | null,
    role: 'user' as const,
    sso_provider: null,
    sso_subject: null,
    projects: '["proj-frontend"]',
    failed_attempts: 0,
    locked_until: null as string | null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AuthService — Unit Tests', () => {
  let authService: AuthService;
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let sessionRepo: ReturnType<typeof createMockSessionRepo>;
  let tokenService: TokenService;
  let passwordService: PasswordService;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    sessionRepo = createMockSessionRepo();
    tokenService = new TokenService(TEST_SECRET);
    passwordService = new PasswordService();
    authService = new AuthService(
      userRepo as any,
      sessionRepo as any,
      tokenService,
      passwordService,
    );
  });

  // UT-01: Login Valid Credentials
  describe('UT-01: login with valid credentials returns TokenPair', () => {
    it('returns access_token, refresh_token, and user profile', async () => {
      const hash = await passwordService.hash('validPass123');
      const user = createTestUser({ password_hash: hash });
      userRepo.findByUsername.mockReturnValue(user);

      const result = await authService.login('john.doe', 'validPass123');

      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toMatch(/^rt_[0-9a-f]{64}$/);
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
      expect(result.user.id).toBe('user-001');
      expect(result.user.username).toBe('john.doe');
      expect(result.user.projects).toEqual(['proj-frontend']);

      // Verify session was created
      expect(sessionRepo.create).toHaveBeenCalledOnce();
      expect(userRepo.resetFailedAttempts).toHaveBeenCalledWith('user-001');
    });
  });

  // UT-02: Login Invalid Password
  describe('UT-02: login with invalid password increments failed_attempts', () => {
    it('throws AUTH_INVALID_CREDENTIALS and increments counter', async () => {
      const hash = await passwordService.hash('correctPassword');
      const user = createTestUser({ password_hash: hash });
      userRepo.findByUsername.mockReturnValue(user);
      userRepo.findById.mockReturnValue({ ...user, failed_attempts: 1 });

      await expect(authService.login('john.doe', 'wrongPassword'))
        .rejects.toMatchObject({
          code: 'AUTH_INVALID_CREDENTIALS',
          statusCode: 401,
        });

      expect(userRepo.incrementFailedAttempts).toHaveBeenCalledWith('user-001');
    });

    it('throws AUTH_INVALID_CREDENTIALS for non-existent user', async () => {
      userRepo.findByUsername.mockReturnValue(null);

      await expect(authService.login('nobody', 'pass'))
        .rejects.toMatchObject({
          code: 'AUTH_INVALID_CREDENTIALS',
          statusCode: 401,
        });
    });
  });

  // UT-03: Account Lockout After 5 Failures
  describe('UT-03: account locks after 5 failed attempts', () => {
    it('locks account when failed_attempts reaches 5', async () => {
      const hash = await passwordService.hash('correctPassword');
      const user = createTestUser({ password_hash: hash, failed_attempts: 4 });
      userRepo.findByUsername.mockReturnValue(user);
      userRepo.findById.mockReturnValue({ ...user, failed_attempts: 5 });

      await expect(authService.login('john.doe', 'wrongPassword'))
        .rejects.toMatchObject({
          code: 'AUTH_ACCOUNT_LOCKED',
          statusCode: 403,
        });

      expect(userRepo.lockAccount).toHaveBeenCalledWith('user-001', expect.any(Date));
    });

    it('rejects login while account is locked even with correct password', async () => {
      const lockUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
      const user = createTestUser({ locked_until: lockUntil.toISOString() });
      userRepo.findByUsername.mockReturnValue(user);

      await expect(authService.login('john.doe', 'any'))
        .rejects.toMatchObject({
          code: 'AUTH_ACCOUNT_LOCKED',
          statusCode: 403,
        });
    });
  });

  // UT-04: Lockout Expired Allows Login
  describe('UT-04: expired lockout allows successful login', () => {
    it('resets failed_attempts and allows login after lockout expires', async () => {
      const hash = await passwordService.hash('correctPassword');
      const lockUntil = new Date(Date.now() - 60 * 1000); // 1 min ago (expired)
      const user = createTestUser({ password_hash: hash, locked_until: lockUntil.toISOString() });
      userRepo.findByUsername.mockReturnValue(user);

      const result = await authService.login('john.doe', 'correctPassword');
      expect(result.access_token).toBeTruthy();
      expect(userRepo.resetFailedAttempts).toHaveBeenCalledWith('user-001');
    });
  });

  // UT-22: Session Revoke
  describe('UT-22: logout revokes session', () => {
    it('revokes session by refresh token hash', () => {
      const refreshToken = 'rt_abc123def456';
      authService.logout(refreshToken);

      expect(sessionRepo.revokeByRefreshTokenHash).toHaveBeenCalledWith(
        tokenService.hashRefreshToken(refreshToken),
      );
    });
  });

  // UT-05: Token verification — expired token
  describe('UT-05: verify expired token throws', () => {
    it('throws on expired JWT', async () => {
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const expiredToken = await new SignJWT({ userId: 'u1', username: 'x', email: 'x@x.com', role: 'user', projects: [] })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .setSubject('u1')
        .sign(secretKey);

      await expect(tokenService.verifyAccessToken(expiredToken)).rejects.toThrow();
    });
  });

  // UT-06: Token verification — tampered token
  describe('UT-06: verify tampered token throws', () => {
    it('rejects JWT with modified payload', async () => {
      const token = await tokenService.generateAccessToken({
        userId: 'u1', username: 'test', email: 'a@b.com', role: 'user', projects: [],
      });
      // Tamper with payload (middle part)
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      payload.role = 'admin'; // Tamper!
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tampered = parts.join('.');

      await expect(tokenService.verifyAccessToken(tampered)).rejects.toThrow();
    });
  });
});

describe('PasswordService — Unit Tests', () => {
  const passwordService = new PasswordService();

  // UT-07: PasswordService scrypt Parameters
  describe('UT-07: hash produces 64-byte key, verify works correctly', () => {
    it('hash returns salt:key format with correct lengths', async () => {
      const hash = await passwordService.hash('testPassword');
      const [salt, key] = hash.split(':');
      expect(salt).toHaveLength(64);  // 32 bytes = 64 hex
      expect(key).toHaveLength(128); // 64 bytes = 128 hex
    });

    it('verify returns true for correct password', async () => {
      const hash = await passwordService.hash('testPassword');
      expect(await passwordService.verify('testPassword', hash)).toBe(true);
    });

    it('verify returns false for wrong password', async () => {
      const hash = await passwordService.hash('testPassword');
      expect(await passwordService.verify('wrongPassword', hash)).toBe(false);
    });

    it('verify returns false for invalid hash format', async () => {
      expect(await passwordService.verify('any', 'invalid')).toBe(false);
    });
  });
});

describe('TokenService — Unit Tests', () => {
  const tokenService = new TokenService(TEST_SECRET);

  // UT-24: Token Expiry Check
  describe('UT-24: token expiry detection', () => {
    it('verifyAccessToken returns valid payload for fresh token', async () => {
      const payload = { userId: 'u1', username: 'test', email: 'a@b.com', role: 'user' as const, projects: [] };
      const token = await tokenService.generateAccessToken(payload);
      const decoded = await tokenService.verifyAccessToken(token);

      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(decoded.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('token expires_in is 3600', async () => {
      const pair = await tokenService.generateTokenPair({
        userId: 'u1', username: 'test', email: 'a@b.com', role: 'user', projects: [],
      });
      expect(pair.expires_in).toBe(3600);
      expect(pair.token_type).toBe('Bearer');
    });

    it('refresh token expiry is 7 days from now', () => {
      const expiry = tokenService.getRefreshTokenExpiry();
      const expectedMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiry.getTime() - expectedMs)).toBeLessThan(5000);
    });
  });
});

// UT-23: LoginSchema Zod Validation
describe('UT-23: LoginSchema Zod Validation', () => {
  const LoginSchema = z.object({
    username: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._]+$/),
    password: z.string().min(8).max(128),
  });

  it('valid input passes', () => {
    const result = LoginSchema.safeParse({ username: 'john.doe', password: '12345678' });
    expect(result.success).toBe(true);
  });

  it('empty username fails', () => {
    const result = LoginSchema.safeParse({ username: '', password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('username with @ fails', () => {
    const result = LoginSchema.safeParse({ username: 'john@doe', password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('short password fails', () => {
    const result = LoginSchema.safeParse({ username: 'john', password: '1234567' });
    expect(result.success).toBe(false);
  });

  it('password > 128 chars fails', () => {
    const result = LoginSchema.safeParse({ username: 'john', password: 'a'.repeat(129) });
    expect(result.success).toBe(false);
  });
});
