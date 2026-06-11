/**
 * EncryptionService Tests
 * PBT-03: AES-256-GCM Encryption Roundtrip
 * UT-13: EncryptionService Roundtrip (deterministic)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EncryptionService } from '../EncryptionService';

const TEST_KEY = 'test-encryption-key-32-bytes!!!'; // Exactly 32 chars

describe('EncryptionService — Property-Based Tests', () => {
  const encryptionService = new EncryptionService(TEST_KEY);

  // PBT-03: AES-256-GCM Encryption Roundtrip
  describe('PBT-03: decrypt(encrypt(input)) === input for any string', () => {
    it('roundtrip preserves original data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 5000 }),
          (plaintext) => {
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('encrypting same plaintext produces different ciphertext (random IV)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (plaintext) => {
            const enc1 = encryptionService.encrypt(plaintext);
            const enc2 = encryptionService.encrypt(plaintext);
            expect(enc1).not.toBe(enc2);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('encrypted format is iv:ciphertext:authTag (hex)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (plaintext) => {
            const encrypted = encryptionService.encrypt(plaintext);
            const parts = encrypted.split(':');
            expect(parts).toHaveLength(3);
            expect(parts[0]).toMatch(/^[0-9a-f]{24}$/); // 12 bytes IV = 24 hex
            expect(parts[2]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes tag = 32 hex
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});

describe('EncryptionService — Unit Tests', () => {
  const encryptionService = new EncryptionService(TEST_KEY);

  // UT-13: EncryptionService Roundtrip
  describe('UT-13: encrypt/decrypt roundtrip with known values', () => {
    it('encrypts and decrypts "secret-token" correctly', () => {
      const plaintext = 'secret-token';
      const encrypted = encryptionService.encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':');

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('decrypt with wrong key throws error', () => {
      const encrypted = encryptionService.encrypt('hello');
      const wrongKeyService = new EncryptionService('wrong-key-that-is-different!!!xx');
      expect(() => wrongKeyService.decrypt(encrypted)).toThrow();
    });

    it('decrypt with invalid format throws error', () => {
      expect(() => encryptionService.decrypt('invalid')).toThrow('Invalid encrypted data format');
      expect(() => encryptionService.decrypt('a:b')).toThrow('Invalid encrypted data format');
    });

    it('isEncrypted detects valid format', () => {
      const encrypted = encryptionService.encrypt('test');
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
      expect(encryptionService.isEncrypted('plaintext')).toBe(false);
      expect(encryptionService.isEncrypted('a:b:c')).toBe(false);
    });
  });
});
