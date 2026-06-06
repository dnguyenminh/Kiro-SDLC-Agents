/**
 * Token Refresh — KSA-237
 *
 * Auto-refreshes Kiro SSO access tokens so the gateway keeps working without
 * the user re-logging into Kiro IDE. Ported from kiro.rs
 * `src/kiro/token_manager.rs`.
 *
 * Two refresh flows:
 *  - social  -> POST https://prod.{authRegion}.auth.desktop.kiro.dev/refreshToken
 *  - idc      -> POST https://oidc.{authRegion}.amazonaws.com/token
 *
 * After a successful refresh the new token fields are written back to the
 * discovered credential file (preserving all other fields) so subsequent runs
 * and Kiro IDE itself pick up the fresh token.
 */
import { KiroSSOToken } from './auth-resolver.js';
export interface RefreshResult {
    accessToken: string;
    refreshToken?: string;
    profileArn?: string;
    /** New absolute expiry (ISO string). */
    expiresAt: string;
}
/** Raised when the refresh token itself is dead and the user must re-login. */
export declare class RefreshTokenExpiredError extends Error {
    constructor(message: string);
}
/** Generic refresh failure (network / server / parse). */
export declare class TokenRefreshError extends Error {
    constructor(message: string);
}
/** expiresAt <= now + 5min → needs refresh. */
export declare function isTokenExpired(token: Pick<KiroSSOToken, 'expiresAt'>): boolean;
/** expiresAt <= now + 10min → should refresh proactively. */
export declare function isTokenExpiringSoon(token: Pick<KiroSSOToken, 'expiresAt'>): boolean;
/**
 * Decide whether a token uses the IdC refresh flow.
 * IdC requires clientId + clientSecret; social does not.
 */
export declare function isIdcToken(token: KiroSSOToken): boolean;
/**
 * Resolve the AUTH region used for the refresh endpoint.
 * Priority: token.authRegion > token.region > default us-east-1.
 */
export declare function resolveAuthRegion(token: KiroSSOToken): string;
interface HttpJsonResponse {
    status: number;
    body: string;
}
/** Transport function type (injectable for testing). */
export type JsonPoster = (url: string, headers: Record<string, string>, body: string, timeoutMs?: number) => Promise<HttpJsonResponse>;
/** Override the JSON POST transport (test seam). Pass null to reset. */
export declare function setJsonPoster(poster: JsonPoster | null): void;
/**
 * Refresh a SOCIAL token via the Kiro desktop auth endpoint.
 */
export declare function refreshSocialToken(token: KiroSSOToken): Promise<RefreshResult>;
/**
 * Refresh an IdC / Builder-ID token via the AWS SSO-OIDC endpoint.
 */
export declare function refreshIdcToken(token: KiroSSOToken): Promise<RefreshResult>;
/**
 * Refresh a token using the appropriate flow for its authMethod.
 */
export declare function refreshToken(token: KiroSSOToken): Promise<RefreshResult>;
export {};
//# sourceMappingURL=token-refresh.d.ts.map