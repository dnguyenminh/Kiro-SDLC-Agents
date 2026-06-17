/**
 * PasswordService — scrypt-based password hashing and verification.
 * Implements TDD §5.2, FSD BR-5: scrypt (N=16384, r=8, p=1, keyLen=64).
 * Uses Node.js built-in crypto — no external bcrypt dependency.
 */
export declare class PasswordService {
    /**
     * Hash a plaintext password with a random salt.
     * Format: salt:hash (both hex-encoded)
     */
    hash(password: string): Promise<string>;
    /**
     * Verify a plaintext password against a stored hash.
     * Uses timing-safe comparison to prevent timing attacks.
     */
    verify(password: string, storedHash: string): Promise<boolean>;
}
//# sourceMappingURL=PasswordService.d.ts.map