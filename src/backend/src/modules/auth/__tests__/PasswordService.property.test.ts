/**
 * PasswordService Property-Based Tests
 * PBT-02: Password Hash Non-Determinism
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PasswordService } from '../PasswordService';

describe('PasswordService — Property-Based Tests', () => {
  const passwordService = new PasswordService();

  // PBT-02: Password Hash Non-Determinism
  describe('PBT-02: hash(pw) !== hash(pw) (different salt), AND verify(pw, hash(pw)) === true', () => {
    it('two hashes of same password are different (random salt)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 64 }),
          async (password) => {
            const hash1 = await passwordService.hash(password);
            const hash2 = await passwordService.hash(password);
            // Different salt → different hash
            expect(hash1).not.toBe(hash2);
          },
        ),
        { numRuns: 10 }, // scrypt is slow — limit runs
      );
    });

    it('verify(pw, hash(pw)) always returns true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 64 }),
          async (password) => {
            const hash = await passwordService.hash(password);
            const valid = await passwordService.verify(password, hash);
            expect(valid).toBe(true);
          },
        ),
        { numRuns: 10 },
      );
    });

    it('verify(wrong, hash(pw)) always returns false', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 32 }),
          fc.string({ minLength: 8, maxLength: 32 }),
          async (password, wrongPassword) => {
            fc.pre(password !== wrongPassword);
            const hash = await passwordService.hash(password);
            const invalid = await passwordService.verify(wrongPassword, hash);
            expect(invalid).toBe(false);
          },
        ),
        { numRuns: 5 },
      );
    });

    it('hash format is salt:hash (hex encoded)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 32 }),
          async (password) => {
            const hash = await passwordService.hash(password);
            const parts = hash.split(':');
            expect(parts).toHaveLength(2);
            expect(parts[0]).toMatch(/^[0-9a-f]{64}$/); // 32 bytes salt = 64 hex chars
            expect(parts[1]).toMatch(/^[0-9a-f]{128}$/); // 64 bytes key = 128 hex chars
          },
        ),
        { numRuns: 5 },
      );
    });
  });
});
