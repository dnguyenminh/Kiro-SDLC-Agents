/**
 * EncryptionService — AES-256-GCM encryption for sensitive config data.
 * Implements TDD §5.2, FSD BR-16: sensitive fields encrypted at rest.
 * Uses Node.js built-in crypto — no external dependencies.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;     // 96 bits recommended for GCM
const TAG_LENGTH = 16;    // 128 bits auth tag
const KEY_LENGTH = 32;    // 256 bits

export class EncryptionService {
  private readonly key: Buffer;

  constructor(encryptionKey: string) {
    // Derive 32-byte key from provided string (pad/truncate)
    const keyBuffer = Buffer.alloc(KEY_LENGTH);
    const srcBuffer = Buffer.from(encryptionKey, 'utf-8');
    srcBuffer.copy(keyBuffer, 0, 0, Math.min(srcBuffer.length, KEY_LENGTH));
    this.key = keyBuffer;
  }

  /**
   * Encrypt plaintext string.
   * Returns: iv:ciphertext:authTag (all hex-encoded)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  /**
   * Decrypt a previously encrypted string.
   * Input format: iv:ciphertext:authTag (all hex-encoded)
   */
  decrypt(encryptedData: string): string {
    const [ivHex, ciphertext, authTagHex] = encryptedData.split(':');
    if (!ivHex || !ciphertext || !authTagHex) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  /**
   * Check if a string looks like encrypted data (has the iv:data:tag format).
   */
  isEncrypted(value: string): boolean {
    const parts = value.split(':');
    return parts.length === 3 && parts[0]!.length === IV_LENGTH * 2;
  }
}
