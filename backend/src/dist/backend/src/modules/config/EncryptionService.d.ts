/**
 * EncryptionService — AES-256-GCM encryption for sensitive config data.
 * Implements TDD §5.2, FSD BR-16: sensitive fields encrypted at rest.
 * Uses Node.js built-in crypto — no external dependencies.
 */
export declare class EncryptionService {
    private readonly key;
    constructor(encryptionKey: string);
    /**
     * Encrypt plaintext string.
     * Returns: iv:ciphertext:authTag (all hex-encoded)
     */
    encrypt(plaintext: string): string;
    /**
     * Decrypt a previously encrypted string.
     * Input format: iv:ciphertext:authTag (all hex-encoded)
     */
    decrypt(encryptedData: string): string;
    /**
     * Check if a string looks like encrypted data (has the iv:data:tag format).
     */
    isEncrypted(value: string): boolean;
}
//# sourceMappingURL=EncryptionService.d.ts.map