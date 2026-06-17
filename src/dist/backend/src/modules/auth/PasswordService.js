/**
 * PasswordService — scrypt-based password hashing and verification.
 * Implements TDD §5.2, FSD BR-5: scrypt (N=16384, r=8, p=1, keyLen=64).
 * Uses Node.js built-in crypto — no external bcrypt dependency.
 */
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
const SCRYPT_PARAMS = {
    N: 16384,
    r: 8,
    p: 1,
    keyLen: 64,
    saltLen: 32,
};
export class PasswordService {
    /**
     * Hash a plaintext password with a random salt.
     * Format: salt:hash (both hex-encoded)
     */
    async hash(password) {
        const salt = randomBytes(SCRYPT_PARAMS.saltLen);
        const derivedKey = await new Promise((resolve, reject) => {
            scrypt(password, salt, SCRYPT_PARAMS.keyLen, { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p }, (err, key) => {
                if (err)
                    reject(err);
                else
                    resolve(key);
            });
        });
        return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
    }
    /**
     * Verify a plaintext password against a stored hash.
     * Uses timing-safe comparison to prevent timing attacks.
     */
    async verify(password, storedHash) {
        const [saltHex, hashHex] = storedHash.split(':');
        if (!saltHex || !hashHex) {
            return false;
        }
        const salt = Buffer.from(saltHex, 'hex');
        const expectedHash = Buffer.from(hashHex, 'hex');
        const derivedKey = await new Promise((resolve, reject) => {
            scrypt(password, salt, SCRYPT_PARAMS.keyLen, { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p }, (err, key) => {
                if (err)
                    reject(err);
                else
                    resolve(key);
            });
        });
        return timingSafeEqual(derivedKey, expectedHash);
    }
}
//# sourceMappingURL=PasswordService.js.map