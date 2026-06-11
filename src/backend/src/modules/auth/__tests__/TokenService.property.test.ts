/**
 * TokenService Property-Based Tests
 * PBT-01: JWT Token Generation Uniqueness
 * PBT-04: PKCE Code Challenge Derivation
 * PBT-08: Refresh Token Hash Collision Resistance
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TokenService } from '../TokenService';
import { createHash } from 'node:crypto';

const TEST_SECRET = 'test-jwt-secret-key-for-testing-only-256bits!';

describe('TokenService — Property-Based Tests', () => {
  const tokenService = new TokenService(TEST_SECRET);

  // PBT-01: JWT Token Generation Uniqueness
  describe('PBT-01: JWT generation produces unique, verifiable tokens', () => {
    it('for any random payload, sign() produces a JWT that verify() decodes with matching payload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            username: fc.stringMatching(/^[a-zA-Z0-9._]{1,50}$/),
            email: fc.emailAddress(),
            role: fc.constantFrom('user' as const, 'admin' as const),
            projects: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
          }),
          async (payload) => {
            const token = await tokenService.generateAccessToken(payload);
            expect(token).toBeTruthy();
            expect(token.split('.')).toHaveLength(3);

            const decoded = await tokenService.verifyAccessToken(token);
            expect(decoded.userId).toBe(payload.userId);
            expect(decoded.username).toBe(payload.username);
            expect(decoded.email).toBe(payload.email);
            expect(decoded.role).toBe(payload.role);
            expect(decoded.projects).toEqual(payload.projects);
          },
        ),
        { numRuns: 50 }, // Keep reasonable for CI speed
      );
    });

    it('different payloads produce different JWTs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (userId1, userId2) => {
            fc.pre(userId1 !== userId2);
            const token1 = await tokenService.generateAccessToken({
              userId: userId1, username: 'user1', email: 'a@b.com', role: 'user', projects: [],
            });
            const token2 = await tokenService.generateAccessToken({
              userId: userId2, username: 'user2', email: 'c@d.com', role: 'user', projects: [],
            });
            expect(token1).not.toBe(token2);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  // PBT-04: PKCE Code Challenge Derivation
  describe('PBT-04: SHA-256 hashing is deterministic and collision-resistant', () => {
    it('SHA256(verifier) produces consistent challenge; different verifiers never collide', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 43, maxLength: 128 }),
          fc.string({ minLength: 43, maxLength: 128 }),
          (verifier1, verifier2) => {
            const hash1a = createHash('sha256').update(verifier1).digest('base64url');
            const hash1b = createHash('sha256').update(verifier1).digest('base64url');
            // Deterministic
            expect(hash1a).toBe(hash1b);

            if (verifier1 !== verifier2) {
              const hash2 = createHash('sha256').update(verifier2).digest('base64url');
              // Collision resistant
              expect(hash1a).not.toBe(hash2);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // PBT-08: Refresh Token Hash Collision Resistance
  describe('PBT-08: Refresh token hashing is deterministic; no collisions for different tokens', () => {
    it('hashRefreshToken is deterministic', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (token) => {
            const hash1 = tokenService.hashRefreshToken(token);
            const hash2 = tokenService.hashRefreshToken(token);
            expect(hash1).toBe(hash2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('different tokens produce different hashes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          (token1, token2) => {
            fc.pre(token1 !== token2);
            const hash1 = tokenService.hashRefreshToken(token1);
            const hash2 = tokenService.hashRefreshToken(token2);
            expect(hash1).not.toBe(hash2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('refresh token format is rt_{hex64}', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          () => {
            const token = tokenService.generateRefreshToken();
            expect(token).toMatch(/^rt_[0-9a-f]{64}$/);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
