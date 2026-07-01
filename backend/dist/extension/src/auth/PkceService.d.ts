/**
 * PkceService — PKCE code_verifier and code_challenge generation for SSO.
 * KSA-292: New service (TDD §4.7, §7.2).
 */
export declare class PkceService {
    /**
     * Generate a cryptographically random code_verifier (43-128 chars, base64url).
     */
    generateCodeVerifier(): string;
    /**
     * Generate code_challenge from code_verifier using S256 method.
     */
    generateCodeChallenge(verifier: string): string;
    /**
     * Base64url encode (RFC 7636).
     */
    private base64UrlEncode;
}
