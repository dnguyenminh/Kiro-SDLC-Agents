/**
 * Auth Resolver — KSA-237 (Anthropic-compatible Gateway)
 *
 * kiro-ts is a LOCAL GATEWAY that exposes the Anthropic Messages API
 * (`/v1/messages`) but uses Kiro SSO credentials behind the scenes to call
 * CodeWhisperer (`q.{region}.amazonaws.com/generateAssistantResponse`).
 *
 * External agents (Cline, Cursor, custom agents, the SDLC pipeline...) point
 * their Anthropic base URL at `http://127.0.0.1:{port}` and use the STABLE
 * gateway API key. No real Anthropic API key is required.
 *
 * Gateway auth rules (resolveAuth):
 * 1. Valid Kiro SSO credentials present
 *    -> ALWAYS use `kiro` mode (convert to CodeWhisperer).
 *      The client x-api-key only VALIDATES gateway access; a mismatching key
 *      does NOT cause a passthrough to api.anthropic.com.
 *      Exception: if the client explicitly sends a REAL Anthropic key
 *      (`sk-ant-...`), honour the api_key passthrough (user opted in).
 * 2. No Kiro credentials present
 *    -> fall back to `api_key` passthrough to api.anthropic.com when a key is
 *      supplied (this is the user deliberately bringing their own key).
 *
 * Gateway key (`sk-kiro-...`) is STABLE: generated once and persisted to
 * ~/.aws/sso/cache/kiro-ts-gateway-key, overridable via KIRO_GATEWAY_API_KEY.
 */
import { AuthResult } from './types.js';
export interface KiroSSOToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
    region: string;
    /** Auth region for the SSO/refresh endpoint (may differ from API region). */
    authRegion?: string;
    apiRegion?: string;
    clientIdHash?: string;
    /** OIDC client id (IdC refresh) — usually stored in the {clientIdHash}.json file. */
    clientId?: string;
    /** OIDC client secret (IdC refresh) — usually stored in the {clientIdHash}.json file. */
    clientSecret?: string;
    authMethod?: string;
    provider?: string;
    profileArn?: string;
}
export declare function setCredentialPathOverride(p: string | null): void;
/**
 * Resolve the stable gateway API key.
 * Order: env KIRO_GATEWAY_API_KEY -> persisted file -> generate + persist.
 * The key is `sk-kiro-{hex}` and is STABLE across restarts so external agents
 * can be configured once.
 */
export declare function getGatewayApiKey(): string;
export declare function initializeAuth(): {
    privateKey: string;
    hasKiroCredentials: boolean;
    region: string;
};
/**
 * @deprecated Use getGatewayApiKey(). Kept for backward compatibility with
 * callers that expect the previous "private key" naming.
 */
export declare function getPrivateApiKey(): string;
/**
 * Resolve authentication for an incoming /v1/messages request.
 *
 * Gateway behavior (see file header):
 * - Valid Kiro SSO token present:
 *     * client sends a REAL Anthropic key (`sk-ant-...`) -> api_key passthrough
 *       (user explicitly opted into their own Anthropic billing).
 *     * otherwise -> ALWAYS kiro mode. Gateway key / empty key / local request
 *       all map to kiro mode. A wrong key does NOT trigger Anthropic passthrough.
 * - No Kiro SSO token:
 *     * client sends any key -> api_key passthrough to api.anthropic.com.
 *     * no key -> local-trusted api_key fallback.
 */
export declare function resolveAuth(apiKeyHeader?: string): AuthResult;
export declare function hasValidCredentials(): boolean;
/**
 * Build a `kiro`-mode AuthResult from a Kiro SSO token. Used by callers that
 * obtained a freshly-refreshed token via ensureFreshKiroToken() and need to
 * rebuild the auth fields (bearerToken, profileArn, regions...).
 */
export declare function buildKiroAuthResult(token: KiroSSOToken): AuthResult;
export declare function refreshCredentials(): boolean;
export declare class AuthenticationError extends Error {
    constructor(message: string);
}
/**
 * Auto-discover the Kiro credential file. Tries, in order:
 * 1. env KIRO_AUTH_TOKEN_PATH (explicit override)
 * 2. ~/.aws/sso/cache/kiro-auth-token.json (default well-known path)
 * 3. scan ~/.aws/sso/cache/*.json for a Kiro-flavoured token (SHA1-named files)
 * 4. scan other Kiro IDE dirs (~/.kiro, VS Code globalStorage) for token-like JSON
 *
 * Among all matches the one with the best score (valid + furthest expiry +
 * has refreshToken) is chosen. The result is cached; pass forceRescan to redo.
 */
export declare function discoverKiroTokenPath(opts?: {
    forceRescan?: boolean;
}): string | null;
/** Path of the credential file the active token was loaded from (or null). */
export declare function getActiveTokenPath(): string | null;
/**
 * Invalidate the cached API region (both in-memory and persisted). Call this
 * when the cached region stops resolving / connecting so the next resolve
 * re-probes from scratch.
 */
export declare function invalidateApiRegionCache(): void;
/**
 * Resolve the API region for the CodeWhisperer `q.{region}.amazonaws.com`
 * endpoint — SYNCHRONOUS, cache-only.
 *
 * Order:
 * 1. token.apiRegion (explicit)
 * 2. env KIRO_API_REGION
 * 3. in-memory probe cache (populated by resolveApiRegionAsync)
 * 4. persisted probe cache (~/.aws/sso/cache/kiro-ts-api-region)
 * 5. default us-east-1 (last resort)
 *
 * This never performs DNS lookups. Callers that want auto-probing should call
 * `resolveApiRegionAsync()` once (e.g. on startup / health-check) to populate
 * the cache before building URLs.
 */
export declare function resolveApiRegion(token?: KiroSSOToken | null): string;
/**
 * Resolve the API region with DNS auto-probing — ASYNCHRONOUS.
 *
 * Order:
 * 1. token.apiRegion (explicit) — skip probe
 * 2. env KIRO_API_REGION — skip probe
 * 3. cached probe result (in-memory or persisted) unless forceProbe
 * 4. AUTO-PROBE: DNS-resolve `q.{region}.amazonaws.com` for candidate regions
 *    in order: token SSO region first, then KNOWN_API_REGIONS. First region
 *    whose host resolves wins, and is cached + persisted.
 * 5. default us-east-1 (last resort)
 */
export declare function resolveApiRegionAsync(token?: KiroSSOToken | null, opts?: {
    forceProbe?: boolean;
}): Promise<string>;
/**
 * Resolve the CodeWhisperer profileArn for `generateAssistantResponse`.
 *
 * Order:
 * 1. profileArn embedded in the kiro-auth-token.json (if present)
 * 2. Environment variable KIRO_PROFILE_ARN / AWS_CODEWHISPERER_PROFILE_ARN
 * 3. Scan other JSON files in ~/.aws/sso/cache for a `profileArn` field
 *
 * Returns undefined when none found — IdC/Enterprise tokens often work without it.
 */
export declare function resolveProfileArn(token?: KiroSSOToken | null): string | undefined;
import { RefreshTokenExpiredError, TokenRefreshError } from './token-refresh.js';
export { RefreshTokenExpiredError, TokenRefreshError };
/**
 * Ensure the in-memory Kiro token is valid, refreshing it when expired or
 * expiring soon. Returns the freshest token (or null when no Kiro credentials
 * are available / refresh is impossible).
 *
 * Concurrency-safe: a single refresh runs at a time; concurrent callers await
 * the same in-flight promise.
 *
 * @throws RefreshTokenExpiredError when the refresh token is permanently dead
 *         (caller should surface a "please re-login to Kiro IDE" message).
 */
export declare function ensureFreshKiroToken(): Promise<KiroSSOToken | null>;
//# sourceMappingURL=auth-resolver.d.ts.map