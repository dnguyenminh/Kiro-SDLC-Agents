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

import * as https from 'https';
import * as crypto from 'crypto';
import { KiroSSOToken } from './auth-resolver.js';
import { resolveMachineId } from './machine-id.js';
import { KIRO_VERSION, AWS_SDK_VERSION, NODE_VERSION, systemVersion } from './kiro-config.js';

const DEFAULT_AUTH_REGION = 'us-east-1';

/** Expiry buffer: token considered expired this long BEFORE its real expiry. */
const EXPIRED_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
/** Soft buffer: token considered "expiring soon" within this window. */
const EXPIRING_SOON_BUFFER_MS = 10 * 60 * 1000; // 10 minutes

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  profileArn?: string;
  /** New absolute expiry (ISO string). */
  expiresAt: string;
}

/** Raised when the refresh token itself is dead and the user must re-login. */
export class RefreshTokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RefreshTokenExpiredError';
  }
}

/** Generic refresh failure (network / server / parse). */
export class TokenRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

/** expiresAt <= now + 5min → needs refresh. */
export function isTokenExpired(token: Pick<KiroSSOToken, 'expiresAt'>): boolean {
  const exp = new Date(token.expiresAt).getTime();
  if (Number.isNaN(exp)) return true;
  return exp - Date.now() <= EXPIRED_BUFFER_MS;
}

/** expiresAt <= now + 10min → should refresh proactively. */
export function isTokenExpiringSoon(token: Pick<KiroSSOToken, 'expiresAt'>): boolean {
  const exp = new Date(token.expiresAt).getTime();
  if (Number.isNaN(exp)) return true;
  return exp - Date.now() <= EXPIRING_SOON_BUFFER_MS;
}

/**
 * Decide whether a token uses the IdC refresh flow.
 * IdC requires clientId + clientSecret; social does not.
 */
export function isIdcToken(token: KiroSSOToken): boolean {
  const method = (token.authMethod || '').toLowerCase();
  if (method === 'social') return false;
  if (method === 'idc' || method === 'builder-id' || method === 'iam') {
    return !!(token.clientId && token.clientSecret);
  }
  // No explicit method: infer from presence of client credentials.
  return !!(token.clientId && token.clientSecret);
}

/**
 * Resolve the AUTH region used for the refresh endpoint.
 * Priority: token.authRegion > token.region > default us-east-1.
 */
export function resolveAuthRegion(token: KiroSSOToken): string {
  if (token.authRegion && token.authRegion.trim()) return token.authRegion.trim();
  if (token.region && token.region.trim()) return token.region.trim();
  return DEFAULT_AUTH_REGION;
}

interface HttpJsonResponse {
  status: number;
  body: string;
}

/** Transport function type (injectable for testing). */
export type JsonPoster = (
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs?: number,
) => Promise<HttpJsonResponse>;

/** Minimal HTTPS JSON POST helper. */
function defaultPostJson(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs = 15000,
): Promise<HttpJsonResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c.toString(); });
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      },
    );
    req.on('error', (err) => reject(new TokenRefreshError(`Refresh request failed: ${err.message}`)));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new TokenRefreshError('Refresh request timed out'));
    });
    req.write(body);
    req.end();
  });
}

/** Active transport — overridable in tests via setJsonPoster(). */
let postJson: JsonPoster = defaultPostJson;

/** Override the JSON POST transport (test seam). Pass null to reset. */
export function setJsonPoster(poster: JsonPoster | null): void {
  postJson = poster || defaultPostJson;
}

/** Detect the "refresh token is dead" condition from a 400 response body. */
function isInvalidGrant(status: number, body: string): boolean {
  if (status !== 400) return false;
  const lower = body.toLowerCase();
  return lower.includes('invalid_grant') || lower.includes('invalid refresh token');
}

function computeExpiresAt(expiresIn: number | undefined): string {
  // Default to 1h if the server omits expiresIn (Kiro SSO tokens live ~1h).
  const seconds = typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Refresh a SOCIAL token via the Kiro desktop auth endpoint.
 */
export async function refreshSocialToken(token: KiroSSOToken): Promise<RefreshResult> {
  if (!token.refreshToken) {
    throw new RefreshTokenExpiredError('No refreshToken present — user must re-login to Kiro IDE.');
  }
  const authRegion = resolveAuthRegion(token);
  const host = `prod.${authRegion}.auth.desktop.kiro.dev`;
  const url = `https://${host}/refreshToken`;
  const machineId = resolveMachineId({ seed: token.refreshToken });

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'User-Agent': `KiroIDE-${KIRO_VERSION}-${machineId}`,
    'Accept-Encoding': 'gzip, deflate, br',
    host,
  };
  const body = JSON.stringify({ refreshToken: token.refreshToken });

  const res = await postJson(url, headers, body);
  if (isInvalidGrant(res.status, res.body)) {
    throw new RefreshTokenExpiredError(
      'Refresh token rejected (invalid_grant) — user must re-login to Kiro IDE.',
    );
  }
  if (res.status < 200 || res.status >= 300) {
    throw new TokenRefreshError(`Social refresh failed (HTTP ${res.status}): ${res.body.substring(0, 300)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new TokenRefreshError('Social refresh returned non-JSON response');
  }
  if (!parsed.accessToken) {
    throw new TokenRefreshError('Social refresh response missing accessToken');
  }

  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken || token.refreshToken,
    profileArn: parsed.profileArn || token.profileArn,
    expiresAt: computeExpiresAt(parsed.expiresIn),
  };
}

/**
 * Refresh an IdC / Builder-ID token via the AWS SSO-OIDC endpoint.
 */
export async function refreshIdcToken(token: KiroSSOToken): Promise<RefreshResult> {
  if (!token.refreshToken) {
    throw new RefreshTokenExpiredError('No refreshToken present — user must re-login to Kiro IDE.');
  }
  if (!token.clientId || !token.clientSecret) {
    throw new TokenRefreshError('IdC refresh requires clientId + clientSecret (not found in cache).');
  }
  const authRegion = resolveAuthRegion(token);
  const host = `oidc.${authRegion}.amazonaws.com`;
  const url = `https://${host}/token`;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-amz-user-agent': `aws-sdk-js/${AWS_SDK_VERSION} KiroIDE`,
    'user-agent':
      `aws-sdk-js/${AWS_SDK_VERSION} ua/2.1 os/${systemVersion()} lang/js ` +
      `md/nodejs#${NODE_VERSION} api/sso-oidc#${AWS_SDK_VERSION} m/E KiroIDE`,
    host,
    'amz-sdk-invocation-id': crypto.randomUUID(),
    'amz-sdk-request': 'attempt=1; max=4',
  };
  const body = JSON.stringify({
    clientId: token.clientId,
    clientSecret: token.clientSecret,
    refreshToken: token.refreshToken,
    // AWS SSO-OIDC CreateToken API expects camelCase `grantType` in the JSON
    // body. (grant_type is the OAuth form-encoded name; this endpoint is JSON.)
    grantType: 'refresh_token',
  });

  const res = await postJson(url, headers, body);
  if (isInvalidGrant(res.status, res.body)) {
    throw new RefreshTokenExpiredError(
      'Refresh token rejected (invalid_grant) — user must re-login to Kiro IDE.',
    );
  }
  if (res.status < 200 || res.status >= 300) {
    throw new TokenRefreshError(`IdC refresh failed (HTTP ${res.status}): ${res.body.substring(0, 300)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new TokenRefreshError('IdC refresh returned non-JSON response');
  }
  if (!parsed.accessToken) {
    throw new TokenRefreshError('IdC refresh response missing accessToken');
  }

  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken || token.refreshToken,
    profileArn: parsed.profileArn || token.profileArn,
    expiresAt: computeExpiresAt(parsed.expiresIn),
  };
}

/**
 * Refresh a token using the appropriate flow for its authMethod.
 */
export async function refreshToken(token: KiroSSOToken): Promise<RefreshResult> {
  if (isIdcToken(token)) {
    return refreshIdcToken(token);
  }
  return refreshSocialToken(token);
}
