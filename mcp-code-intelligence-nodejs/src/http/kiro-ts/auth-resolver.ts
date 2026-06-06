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

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as dns from 'dns';
import { AuthResult, AWSCredentials } from './types.js';

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

let kiroToken: KiroSSOToken | null = null;
let gatewayApiKey: string | null = null;
let credentialPathOverride: string | null = null;

/** Absolute path of the credential file the current token was loaded from. */
let discoveredTokenPath: string | null = null;

/** Persisted gateway key file (stable across restarts). */
const GATEWAY_KEY_FILE = 'kiro-ts-gateway-key';

export function setCredentialPathOverride(p: string | null): void {
  credentialPathOverride = p;
  kiroToken = null;
  discoveredTokenPath = null;
  cachedDiscoveredPath = null;
}

function getGatewayKeyPath(): string {
  return path.join(os.homedir(), '.aws', 'sso', 'cache', GATEWAY_KEY_FILE);
}

/** True when the key looks like a REAL Anthropic key (bring-your-own-key). */
function isRealAnthropicKey(key: string): boolean {
  return key.startsWith('sk-ant-');
}

/**
 * Resolve the stable gateway API key.
 * Order: env KIRO_GATEWAY_API_KEY -> persisted file -> generate + persist.
 * The key is `sk-kiro-{hex}` and is STABLE across restarts so external agents
 * can be configured once.
 */
export function getGatewayApiKey(): string {
  if (gatewayApiKey) return gatewayApiKey;

  // 1. Environment override
  const envKey = process.env.KIRO_GATEWAY_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    gatewayApiKey = envKey.trim();
    return gatewayApiKey;
  }

  // 2. Persisted key
  const keyPath = getGatewayKeyPath();
  try {
    if (fs.existsSync(keyPath)) {
      const persisted = fs.readFileSync(keyPath, 'utf-8').trim();
      if (persisted.length > 0) {
        gatewayApiKey = persisted;
        return gatewayApiKey;
      }
    }
  } catch (err) {
    console.error('[kiro-ts] Failed to read persisted gateway key:', (err as Error).message);
  }

  // 3. Generate + persist a new stable key
  gatewayApiKey = `sk-kiro-${crypto.randomBytes(24).toString('hex')}`;
  try {
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.writeFileSync(keyPath, gatewayApiKey, { encoding: 'utf-8', mode: 0o600 });
    console.error(`[kiro-ts] Generated new stable gateway API key (persisted to ${keyPath})`);
  } catch (err) {
    console.error('[kiro-ts] Failed to persist gateway key (using in-memory only):', (err as Error).message);
  }
  return gatewayApiKey;
}

export function initializeAuth(): { privateKey: string; hasKiroCredentials: boolean; region: string } {
  kiroToken = readKiroSSOToken();
  const key = getGatewayApiKey();
  return {
    privateKey: key,
    hasKiroCredentials: kiroToken !== null,
    region: kiroToken?.region || 'us-east-1',
  };
}

/**
 * @deprecated Use getGatewayApiKey(). Kept for backward compatibility with
 * callers that expect the previous "private key" naming.
 */
export function getPrivateApiKey(): string {
  return getGatewayApiKey();
}

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
export function resolveAuth(apiKeyHeader?: string): AuthResult {
  const gatewayKey = getGatewayApiKey();
  const headerKey = (apiKeyHeader || '').trim();

  // Lazily (re)load the Kiro SSO token. Re-read from disk when we don't have a
  // valid token yet so a fresh Kiro IDE login is picked up without a restart.
  if (!kiroToken || isTokenExpired(kiroToken)) {
    kiroToken = readKiroSSOToken();
  }

  if (kiroToken && !isTokenExpired(kiroToken)) {
    // User explicitly brought a real Anthropic key -> honour passthrough.
    if (headerKey.length > 0 && isRealAnthropicKey(headerKey)) {
      return { mode: 'api_key', apiKey: headerKey };
    }
    // Otherwise the gateway always serves Kiro mode. The client key is only a
    // gateway-access validator; mismatches do not fall through to Anthropic.
    if (headerKey.length > 0 && headerKey !== gatewayKey) {
      // Localhost is trusted; log the mismatch but still serve Kiro mode so the
      // gateway "just works" for locally-running agents.
      console.error('[kiro-ts] x-api-key does not match gateway key — serving Kiro mode anyway (local gateway)');
    }
    return {
      mode: 'kiro',
      credentials: { accessKeyId: '', secretAccessKey: '', sessionToken: kiroToken.accessToken, expiration: new Date(kiroToken.expiresAt) },
      region: kiroToken.region,
      apiRegion: resolveApiRegion(kiroToken),
      bearerToken: kiroToken.accessToken,
      refreshToken: kiroToken.refreshToken,
      profileArn: resolveProfileArn(kiroToken),
    };
  }

  // No Kiro credentials: bring-your-own Anthropic key passthrough.
  if (headerKey.length > 0) {
    return { mode: 'api_key', apiKey: headerKey };
  }

  // Local trusted: accept without auth
  console.error('[kiro-ts] No Kiro credentials and no API key — accepting as local trusted');
  return { mode: 'api_key' as const, apiKey: 'local-trusted' };
}

export function hasValidCredentials(): boolean {
  if (!kiroToken) { kiroToken = readKiroSSOToken(); }
  return kiroToken !== null && !isTokenExpired(kiroToken);
}

/**
 * Build a `kiro`-mode AuthResult from a Kiro SSO token. Used by callers that
 * obtained a freshly-refreshed token via ensureFreshKiroToken() and need to
 * rebuild the auth fields (bearerToken, profileArn, regions...).
 */
export function buildKiroAuthResult(token: KiroSSOToken): AuthResult {
  return {
    mode: 'kiro',
    credentials: {
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: token.accessToken,
      expiration: new Date(token.expiresAt),
    },
    region: token.region,
    apiRegion: resolveApiRegion(token),
    bearerToken: token.accessToken,
    refreshToken: token.refreshToken,
    profileArn: resolveProfileArn(token),
  };
}

export function refreshCredentials(): boolean {
  kiroToken = readKiroSSOToken();
  return kiroToken !== null;
}

export class AuthenticationError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthenticationError'; }
}

function readKiroSSOToken(): KiroSSOToken | null {
  // Explicit override always wins (used by tests and KIRO_AUTH_TOKEN_PATH env).
  if (credentialPathOverride) {
    return readTokenFromPath(credentialPathOverride);
  }

  const tokenPath = discoverKiroTokenPath();
  if (!tokenPath) {
    console.error('[kiro-ts] No Kiro credential file discovered in any known location.');
    return null;
  }
  return readTokenFromPath(tokenPath);
}

/**
 * Read + validate a single credential file. On success records the path in
 * `discoveredTokenPath` and enriches IdC tokens with clientId/clientSecret.
 */
function readTokenFromPath(tokenPath: string): KiroSSOToken | null {
  try {
    if (!fs.existsSync(tokenPath)) return null;
    const content = fs.readFileSync(tokenPath, 'utf-8');
    const token = JSON.parse(content) as KiroSSOToken;
    if (!token.accessToken || !token.expiresAt) return null;

    discoveredTokenPath = tokenPath;
    enrichWithClientCredentials(token);

    if (isTokenExpired(token)) {
      // Expired but still returned: ensureFreshKiroToken() can refresh it when
      // a refreshToken is present. resolveAuth treats expired-without-refresh
      // as "no credentials".
      console.error(`[kiro-ts] Kiro SSO token at ${tokenPath} is expired (refreshToken ${token.refreshToken ? 'present' : 'absent'}).`);
    } else {
      console.error(`[kiro-ts] Kiro SSO credentials loaded from ${tokenPath} (region: ${token.region}, authMethod: ${token.authMethod || 'social'}, expires: ${token.expiresAt})`);
    }
    return token;
  } catch (err) {
    console.error('[kiro-ts] Failed to read Kiro SSO token:', (err as Error).message);
    return null;
  }
}

/**
 * For IdC tokens the clientId/clientSecret needed to refresh live in a sibling
 * `{clientIdHash}.json` file in the same SSO cache directory. Merge them in so
 * the refresh module has everything it needs.
 */
function enrichWithClientCredentials(token: KiroSSOToken): void {
  if (token.clientId && token.clientSecret) return;
  if (!token.clientIdHash) return;
  try {
    const dir = path.dirname(discoveredTokenPath || getDefaultKiroTokenPath());
    const clientFile = path.join(dir, `${token.clientIdHash}.json`);
    if (fs.existsSync(clientFile)) {
      const parsed = JSON.parse(fs.readFileSync(clientFile, 'utf-8'));
      if (parsed.clientId) token.clientId = parsed.clientId;
      if (parsed.clientSecret) token.clientSecret = parsed.clientSecret;
    }
  } catch {
    // best effort — refresh will surface a clear error if creds are missing
  }
}

/** True if a parsed JSON object looks like a Kiro/SSO credential token. */
function looksLikeKiroToken(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.accessToken !== 'string' || !obj.accessToken) return false;
  if (!obj.expiresAt) return false;
  // Must be refreshable or clearly Kiro-flavoured.
  const startUrl = typeof obj.startUrl === 'string' ? obj.startUrl.toLowerCase() : '';
  const hasKiroMarker =
    typeof obj.refreshToken === 'string' ||
    obj.authMethod !== undefined ||
    obj.clientIdHash !== undefined ||
    startUrl.includes('kiro') ||
    obj.provider !== undefined;
  return hasKiroMarker;
}

/** Score a token for "freshness": prefer valid + furthest expiry + has refresh. */
function tokenScore(obj: any): number {
  let score = 0;
  const exp = new Date(obj.expiresAt).getTime();
  if (!Number.isNaN(exp)) {
    if (exp > Date.now()) score += 1_000_000_000_000; // still valid beats expired
    score += Math.floor(exp / 1000); // furthest expiry wins among same validity
  }
  if (typeof obj.refreshToken === 'string' && obj.refreshToken.length > 0) score += 500_000_000_000;
  return score;
}

/** Candidate credential directories Kiro IDE may use, per platform. */
function candidateTokenDirs(): string[] {
  const home = os.homedir();
  const dirs: string[] = [
    path.join(home, '.aws', 'sso', 'cache'),
    path.join(home, '.kiro', 'cache'),
    path.join(home, '.kiro'),
  ];

  // VS Code / Kiro globalStorage per platform
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    dirs.push(path.join(appData, 'Kiro', 'User', 'globalStorage'));
  } else if (process.platform === 'darwin') {
    dirs.push(path.join(home, 'Library', 'Application Support', 'Kiro', 'User', 'globalStorage'));
  } else {
    const cfg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    dirs.push(path.join(cfg, 'Kiro', 'User', 'globalStorage'));
  }
  return dirs;
}

let cachedDiscoveredPath: string | null = null;

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
export function discoverKiroTokenPath(opts?: { forceRescan?: boolean }): string | null {
  if (opts?.forceRescan) cachedDiscoveredPath = null;
  if (cachedDiscoveredPath) return cachedDiscoveredPath;

  // 1. explicit env override
  const envPath = process.env.KIRO_AUTH_TOKEN_PATH;
  if (envPath && envPath.trim().length > 0) {
    const p = envPath.trim();
    if (fs.existsSync(p)) {
      cachedDiscoveredPath = p;
      console.error(`[kiro-ts] Using KIRO_AUTH_TOKEN_PATH override: ${p}`);
      return p;
    }
    console.error(`[kiro-ts] KIRO_AUTH_TOKEN_PATH set but file not found: ${p}`);
  }

  // 2. default well-known path (fast path)
  const defaultPath = getDefaultKiroTokenPath();
  if (fs.existsSync(defaultPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
      if (looksLikeKiroToken(parsed)) {
        cachedDiscoveredPath = defaultPath;
        console.error(`[kiro-ts] Discovered Kiro credential at default path: ${defaultPath}`);
        return defaultPath;
      }
    } catch {
      // fall through to scanning
    }
  }

  // 3 + 4. scan candidate directories for the best token-like JSON file
  let best: { path: string; score: number } | null = null;
  for (const dir of candidateTokenDirs()) {
    try {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        const full = path.join(dir, file);
        try {
          const parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
          if (!looksLikeKiroToken(parsed)) continue;
          const score = tokenScore(parsed);
          if (!best || score > best.score) {
            best = { path: full, score };
          }
        } catch {
          // ignore malformed / unreadable files
        }
      }
    } catch {
      // ignore unreadable directories
    }
  }

  if (best) {
    cachedDiscoveredPath = best.path;
    console.error(`[kiro-ts] Discovered Kiro credential by scan: ${best.path}`);
    return best.path;
  }

  return null;
}

/** Path of the credential file the active token was loaded from (or null). */
export function getActiveTokenPath(): string | null {
  return credentialPathOverride || discoveredTokenPath || cachedDiscoveredPath;
}

function getDefaultKiroTokenPath(): string {
  return path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
}

/** @deprecated kept for compatibility; prefer discoverKiroTokenPath(). */
function getKiroTokenPath(): string {
  return discoverKiroTokenPath() || getDefaultKiroTokenPath();
}

function isTokenExpired(token: KiroSSOToken): boolean {
  return (new Date(token.expiresAt).getTime() - Date.now()) < (5 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// API region auto-detection (KSA-237)
// ---------------------------------------------------------------------------

/**
 * Known regions where the CodeWhisperer `q.{region}.amazonaws.com` endpoint is
 * deployed. Probed in this order AFTER the token's own SSO region.
 */
const KNOWN_API_REGIONS = [
  'us-east-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'us-west-2',
];

const DEFAULT_API_REGION = 'us-east-1';

/** DNS lookup timeout per candidate region (ms). */
const PROBE_TIMEOUT_MS = 2000;

/** Persisted cache file for the resolved API region. */
const API_REGION_CACHE_FILE = 'kiro-ts-api-region';

/** In-memory cache of the resolved API region (avoids re-probing per request). */
let cachedApiRegion: string | null = null;

/**
 * Build the CodeWhisperer host for a region.
 */
function apiHostForRegion(region: string): string {
  return `q.${region}.amazonaws.com`;
}

function getApiRegionCachePath(): string {
  return path.join(os.homedir(), '.aws', 'sso', 'cache', API_REGION_CACHE_FILE);
}

/** Read a previously persisted API region (best effort). */
function readPersistedApiRegion(): string | null {
  try {
    const p = getApiRegionCachePath();
    if (!fs.existsSync(p)) return null;
    const region = fs.readFileSync(p, 'utf-8').trim();
    return region.length > 0 ? region : null;
  } catch {
    return null;
  }
}

/** Persist the resolved API region (best effort, never throws). */
function persistApiRegion(region: string): void {
  try {
    fs.writeFileSync(getApiRegionCachePath(), region, 'utf-8');
  } catch {
    // ignore persist failures (read-only fs, permissions, etc.)
  }
}

/**
 * Invalidate the cached API region (both in-memory and persisted). Call this
 * when the cached region stops resolving / connecting so the next resolve
 * re-probes from scratch.
 */
export function invalidateApiRegionCache(): void {
  cachedApiRegion = null;
  try {
    const p = getApiRegionCachePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

/** Resolve an explicit API region override (token.apiRegion > env). */
function explicitApiRegion(token?: KiroSSOToken | null): string | null {
  const t = token ?? kiroToken;
  if (t?.apiRegion && t.apiRegion.trim().length > 0) {
    return t.apiRegion.trim();
  }
  const envRegion = process.env.KIRO_API_REGION;
  if (envRegion && envRegion.trim().length > 0) {
    return envRegion.trim();
  }
  return null;
}

/** DNS-resolve a single host with a timeout. Resolves true if it resolves. */
function dnsResolves(host: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    dns.promises
      .lookup(host)
      .then(() => {
        clearTimeout(timer);
        finish(true);
      })
      .catch(() => {
        clearTimeout(timer);
        finish(false);
      });
  });
}

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
export function resolveApiRegion(token?: KiroSSOToken | null): string {
  const explicit = explicitApiRegion(token);
  if (explicit) return explicit;

  if (cachedApiRegion) return cachedApiRegion;

  const persisted = readPersistedApiRegion();
  if (persisted) {
    cachedApiRegion = persisted;
    return persisted;
  }

  return DEFAULT_API_REGION;
}

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
export async function resolveApiRegionAsync(
  token?: KiroSSOToken | null,
  opts?: { forceProbe?: boolean },
): Promise<string> {
  const explicit = explicitApiRegion(token);
  if (explicit) return explicit;

  const forceProbe = opts?.forceProbe === true;

  if (!forceProbe) {
    if (cachedApiRegion) return cachedApiRegion;
    const persisted = readPersistedApiRegion();
    if (persisted) {
      cachedApiRegion = persisted;
      return persisted;
    }
  }

  // Build ordered candidate list: SSO region first (deduped), then known regions.
  const t = token ?? kiroToken;
  const candidates: string[] = [];
  const ssoRegion = t?.region?.trim();
  if (ssoRegion) candidates.push(ssoRegion);
  for (const r of KNOWN_API_REGIONS) {
    if (!candidates.includes(r)) candidates.push(r);
  }

  for (const region of candidates) {
    const host = apiHostForRegion(region);
    // eslint-disable-next-line no-await-in-loop
    const ok = await dnsResolves(host, PROBE_TIMEOUT_MS);
    if (ok) {
      console.error(`[kiro-ts] API region auto-detected via DNS probe: ${region} (${host})`);
      cachedApiRegion = region;
      persistApiRegion(region);
      return region;
    }
  }

  console.error(`[kiro-ts] API region probe failed for all candidates — falling back to ${DEFAULT_API_REGION}`);
  cachedApiRegion = DEFAULT_API_REGION;
  return DEFAULT_API_REGION;
}

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
export function resolveProfileArn(token?: KiroSSOToken | null): string | undefined {
  const t = token ?? kiroToken;
  if (t?.profileArn && t.profileArn.startsWith('arn:aws:codewhisperer:')) {
    return t.profileArn;
  }

  const envArn = process.env.KIRO_PROFILE_ARN || process.env.AWS_CODEWHISPERER_PROFILE_ARN;
  if (envArn && envArn.startsWith('arn:aws:codewhisperer:')) {
    return envArn;
  }

  // Scan SSO cache for any file exposing a profileArn
  try {
    const cacheDir = path.join(os.homedir(), '.aws', 'sso', 'cache');
    if (fs.existsSync(cacheDir)) {
      for (const file of fs.readdirSync(cacheDir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf-8'));
          const arn = parsed?.profileArn || parsed?.profile_arn;
          if (typeof arn === 'string' && arn.startsWith('arn:aws:codewhisperer:')) {
            return arn;
          }
        } catch {
          // ignore malformed files
        }
      }
    }
  } catch {
    // ignore scan failures
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Auto-refresh integration (KSA-237 — Việc B)
// ---------------------------------------------------------------------------

import {
  refreshToken as performRefresh,
  isTokenExpired as refreshIsExpired,
  isTokenExpiringSoon,
  RefreshTokenExpiredError,
  TokenRefreshError,
} from './token-refresh.js';

export { RefreshTokenExpiredError, TokenRefreshError };

/** Single in-flight refresh promise to avoid concurrent duplicate refreshes. */
let inFlightRefresh: Promise<KiroSSOToken | null> | null = null;

/**
 * Write refreshed token fields back to the discovered credential file,
 * preserving every other field already present in the file.
 */
function writeBackToken(updated: KiroSSOToken): void {
  const target = getActiveTokenPath();
  if (!target) {
    console.error('[kiro-ts] Cannot write back refreshed token — no active token path.');
    return;
  }
  try {
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(target)) {
      try {
        existing = JSON.parse(fs.readFileSync(target, 'utf-8'));
      } catch {
        existing = {};
      }
    }
    // Only update the refresh-relevant fields; keep everything else intact.
    existing.accessToken = updated.accessToken;
    if (updated.refreshToken) existing.refreshToken = updated.refreshToken;
    existing.expiresAt = updated.expiresAt;
    if (updated.profileArn) existing.profileArn = updated.profileArn;

    fs.writeFileSync(target, JSON.stringify(existing, null, 2), { encoding: 'utf-8', mode: 0o600 });
    console.error(`[kiro-ts] Wrote refreshed token back to ${target} (new expiry: ${updated.expiresAt}).`);
  } catch (err) {
    console.error('[kiro-ts] Failed to write back refreshed token:', (err as Error).message);
  }
}

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
export async function ensureFreshKiroToken(): Promise<KiroSSOToken | null> {
  // Load token if we don't have one yet (re-scan if needed).
  if (!kiroToken) {
    kiroToken = readKiroSSOToken();
  }
  if (!kiroToken) {
    // Try a fresh scan in case the file appeared / moved.
    discoverKiroTokenPath({ forceRescan: true });
    kiroToken = readKiroSSOToken();
  }
  if (!kiroToken) return null;

  // Token still comfortably valid → use as-is.
  if (!refreshIsExpired(kiroToken) && !isTokenExpiringSoon(kiroToken)) {
    return kiroToken;
  }

  // Need (or want) a refresh. Can we?
  if (!kiroToken.refreshToken) {
    if (refreshIsExpired(kiroToken)) {
      throw new RefreshTokenExpiredError(
        'Kiro token expired and no refreshToken present — please re-login to Kiro IDE.',
      );
    }
    return kiroToken; // expiring soon but nothing we can do; still usable
  }

  // Reuse an in-flight refresh if one is running.
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const tokenToRefresh = kiroToken;
  inFlightRefresh = (async () => {
    try {
      console.error(`[kiro-ts] Refreshing Kiro token (authMethod: ${tokenToRefresh.authMethod || 'social'}, authRegion: ${tokenToRefresh.authRegion || tokenToRefresh.region})...`);
      const result = await performRefresh(tokenToRefresh);
      const refreshed: KiroSSOToken = {
        ...tokenToRefresh,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || tokenToRefresh.refreshToken,
        expiresAt: result.expiresAt,
        profileArn: result.profileArn || tokenToRefresh.profileArn,
      };
      kiroToken = refreshed;
      writeBackToken(refreshed);
      console.error('[kiro-ts] Kiro token refresh succeeded.');
      return refreshed;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}
