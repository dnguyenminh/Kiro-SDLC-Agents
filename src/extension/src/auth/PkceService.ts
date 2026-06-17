/**
 * PkceService — PKCE code_verifier and code_challenge generation for SSO.
 * KSA-292: New service (TDD §4.7, §7.2).
 */

import * as crypto from 'crypto';

export class PkceService {
  /**
   * Generate a cryptographically random code_verifier (43-128 chars, base64url).
   */
  generateCodeVerifier(): string {
    const buffer = crypto.randomBytes(32);
    return this.base64UrlEncode(buffer); // 43 chars
  }

  /**
   * Generate code_challenge from code_verifier using S256 method.
   */
  generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return this.base64UrlEncode(hash);
  }

  /**
   * Base64url encode (RFC 7636).
   */
  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
