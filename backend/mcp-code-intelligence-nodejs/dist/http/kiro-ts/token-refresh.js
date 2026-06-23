"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenRefreshError = exports.RefreshTokenExpiredError = void 0;
exports.isTokenExpired = isTokenExpired;
exports.isTokenExpiringSoon = isTokenExpiringSoon;
exports.isIdcToken = isIdcToken;
exports.resolveAuthRegion = resolveAuthRegion;
exports.setJsonPoster = setJsonPoster;
exports.refreshSocialToken = refreshSocialToken;
exports.refreshIdcToken = refreshIdcToken;
exports.refreshToken = refreshToken;
const https = __importStar(require("https"));
const crypto = __importStar(require("crypto"));
const machine_id_js_1 = require("./machine-id.js");
const kiro_config_js_1 = require("./kiro-config.js");
const DEFAULT_AUTH_REGION = 'us-east-1';
/** Expiry buffer: token considered expired this long BEFORE its real expiry. */
const EXPIRED_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
/** Soft buffer: token considered "expiring soon" within this window. */
const EXPIRING_SOON_BUFFER_MS = 10 * 60 * 1000; // 10 minutes
/** Raised when the refresh token itself is dead and the user must re-login. */
class RefreshTokenExpiredError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RefreshTokenExpiredError';
    }
}
exports.RefreshTokenExpiredError = RefreshTokenExpiredError;
/** Generic refresh failure (network / server / parse). */
class TokenRefreshError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TokenRefreshError';
    }
}
exports.TokenRefreshError = TokenRefreshError;
/** expiresAt <= now + 5min → needs refresh. */
function isTokenExpired(token) {
    const exp = new Date(token.expiresAt).getTime();
    if (Number.isNaN(exp))
        return true;
    return exp - Date.now() <= EXPIRED_BUFFER_MS;
}
/** expiresAt <= now + 10min → should refresh proactively. */
function isTokenExpiringSoon(token) {
    const exp = new Date(token.expiresAt).getTime();
    if (Number.isNaN(exp))
        return true;
    return exp - Date.now() <= EXPIRING_SOON_BUFFER_MS;
}
/**
 * Decide whether a token uses the IdC refresh flow.
 * IdC requires clientId + clientSecret; social does not.
 */
function isIdcToken(token) {
    const method = (token.authMethod || '').toLowerCase();
    if (method === 'social')
        return false;
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
function resolveAuthRegion(token) {
    if (token.authRegion && token.authRegion.trim())
        return token.authRegion.trim();
    if (token.region && token.region.trim())
        return token.region.trim();
    return DEFAULT_AUTH_REGION;
}
/** Minimal HTTPS JSON POST helper. */
function defaultPostJson(url, headers, body, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname,
            port: 443,
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c.toString(); });
            res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
        });
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
let postJson = defaultPostJson;
/** Override the JSON POST transport (test seam). Pass null to reset. */
function setJsonPoster(poster) {
    postJson = poster || defaultPostJson;
}
/** Detect the "refresh token is dead" condition from a 400 response body. */
function isInvalidGrant(status, body) {
    if (status !== 400)
        return false;
    const lower = body.toLowerCase();
    return lower.includes('invalid_grant') || lower.includes('invalid refresh token');
}
function computeExpiresAt(expiresIn) {
    // Default to 1h if the server omits expiresIn (Kiro SSO tokens live ~1h).
    const seconds = typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 3600;
    return new Date(Date.now() + seconds * 1000).toISOString();
}
/**
 * Refresh a SOCIAL token via the Kiro desktop auth endpoint.
 */
async function refreshSocialToken(token) {
    if (!token.refreshToken) {
        throw new RefreshTokenExpiredError('No refreshToken present — user must re-login to Kiro IDE.');
    }
    const authRegion = resolveAuthRegion(token);
    const host = `prod.${authRegion}.auth.desktop.kiro.dev`;
    const url = `https://${host}/refreshToken`;
    const machineId = (0, machine_id_js_1.resolveMachineId)({ seed: token.refreshToken });
    const headers = {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': `KiroIDE-${kiro_config_js_1.KIRO_VERSION}-${machineId}`,
        'Accept-Encoding': 'gzip, deflate, br',
        host,
    };
    const body = JSON.stringify({ refreshToken: token.refreshToken });
    const res = await postJson(url, headers, body);
    if (isInvalidGrant(res.status, res.body)) {
        throw new RefreshTokenExpiredError('Refresh token rejected (invalid_grant) — user must re-login to Kiro IDE.');
    }
    if (res.status < 200 || res.status >= 300) {
        throw new TokenRefreshError(`Social refresh failed (HTTP ${res.status}): ${res.body.substring(0, 300)}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(res.body);
    }
    catch {
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
async function refreshIdcToken(token) {
    if (!token.refreshToken) {
        throw new RefreshTokenExpiredError('No refreshToken present — user must re-login to Kiro IDE.');
    }
    if (!token.clientId || !token.clientSecret) {
        throw new TokenRefreshError('IdC refresh requires clientId + clientSecret (not found in cache).');
    }
    const authRegion = resolveAuthRegion(token);
    const host = `oidc.${authRegion}.amazonaws.com`;
    const url = `https://${host}/token`;
    const headers = {
        'content-type': 'application/json',
        'x-amz-user-agent': `aws-sdk-js/${kiro_config_js_1.AWS_SDK_VERSION} KiroIDE`,
        'user-agent': `aws-sdk-js/${kiro_config_js_1.AWS_SDK_VERSION} ua/2.1 os/${(0, kiro_config_js_1.systemVersion)()} lang/js ` +
            `md/nodejs#${kiro_config_js_1.NODE_VERSION} api/sso-oidc#${kiro_config_js_1.AWS_SDK_VERSION} m/E KiroIDE`,
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
        throw new RefreshTokenExpiredError('Refresh token rejected (invalid_grant) — user must re-login to Kiro IDE.');
    }
    if (res.status < 200 || res.status >= 300) {
        throw new TokenRefreshError(`IdC refresh failed (HTTP ${res.status}): ${res.body.substring(0, 300)}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(res.body);
    }
    catch {
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
async function refreshToken(token) {
    if (isIdcToken(token)) {
        return refreshIdcToken(token);
    }
    return refreshSocialToken(token);
}
//# sourceMappingURL=token-refresh.js.map