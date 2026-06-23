"use strict";
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
/**
 * Token Refresh + Auto-Discovery Unit Tests — KSA-237
 *
 * Covers:
 *  - isTokenExpired / isTokenExpiringSoon thresholds
 *  - isIdcToken / resolveAuthRegion selection
 *  - discoverKiroTokenPath override + scan logic
 *  - social / idc refresh request construction (body + url + headers) by
 *    intercepting https.request
 *  - write-back preserves unrelated fields
 */
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const token_refresh_js_1 = require("../token-refresh.js");
const auth_resolver_js_1 = require("../auth-resolver.js");
const isoIn = (ms) => new Date(Date.now() + ms).toISOString();
// =============================================================================
// UT-RF-01: Expiry detection thresholds
// =============================================================================
(0, vitest_1.describe)('UT-RF-01: isTokenExpired / isTokenExpiringSoon', () => {
    (0, vitest_1.it)('token expiring in 2min counts as expired AND expiring soon', () => {
        const t = { expiresAt: isoIn(2 * 60 * 1000) };
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpired)(t)).toBe(true);
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpiringSoon)(t)).toBe(true);
    });
    (0, vitest_1.it)('token expiring in 7min is NOT expired but IS expiring soon', () => {
        const t = { expiresAt: isoIn(7 * 60 * 1000) };
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpired)(t)).toBe(false);
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpiringSoon)(t)).toBe(true);
    });
    (0, vitest_1.it)('token expiring in 30min is neither expired nor expiring soon', () => {
        const t = { expiresAt: isoIn(30 * 60 * 1000) };
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpired)(t)).toBe(false);
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpiringSoon)(t)).toBe(false);
    });
    (0, vitest_1.it)('malformed expiresAt is treated as expired', () => {
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpired)({ expiresAt: 'not-a-date' })).toBe(true);
        (0, vitest_1.expect)((0, token_refresh_js_1.isTokenExpiringSoon)({ expiresAt: 'not-a-date' })).toBe(true);
    });
});
// =============================================================================
// UT-RF-02: IdC vs social detection + auth region
// =============================================================================
(0, vitest_1.describe)('UT-RF-02: isIdcToken / resolveAuthRegion', () => {
    const base = {
        accessToken: 'a', expiresAt: isoIn(3600_000), region: 'ap-southeast-1',
    };
    (0, vitest_1.it)('authMethod=social → social flow even with client creds', () => {
        (0, vitest_1.expect)((0, token_refresh_js_1.isIdcToken)({ ...base, authMethod: 'social', clientId: 'c', clientSecret: 's' })).toBe(false);
    });
    (0, vitest_1.it)('authMethod=IdC with client creds → idc flow', () => {
        (0, vitest_1.expect)((0, token_refresh_js_1.isIdcToken)({ ...base, authMethod: 'IdC', clientId: 'c', clientSecret: 's' })).toBe(true);
    });
    (0, vitest_1.it)('authMethod=IdC WITHOUT client creds → not treated as idc-capable', () => {
        (0, vitest_1.expect)((0, token_refresh_js_1.isIdcToken)({ ...base, authMethod: 'IdC' })).toBe(false);
    });
    (0, vitest_1.it)('no authMethod but client creds present → idc flow inferred', () => {
        (0, vitest_1.expect)((0, token_refresh_js_1.isIdcToken)({ ...base, clientId: 'c', clientSecret: 's' })).toBe(true);
    });
    (0, vitest_1.it)('authRegion > region > default', () => {
        (0, vitest_1.expect)((0, token_refresh_js_1.resolveAuthRegion)({ ...base, authRegion: 'eu-central-1' })).toBe('eu-central-1');
        (0, vitest_1.expect)((0, token_refresh_js_1.resolveAuthRegion)({ ...base })).toBe('ap-southeast-1');
        (0, vitest_1.expect)((0, token_refresh_js_1.resolveAuthRegion)({ accessToken: 'a', expiresAt: isoIn(1), region: '' })).toBe('us-east-1');
    });
});
// =============================================================================
// UT-RF-03: discoverKiroTokenPath override mechanism
// =============================================================================
(0, vitest_1.describe)('UT-RF-03: discoverKiroTokenPath', () => {
    const tmp = path.join(os.tmpdir(), `kiro-discover-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const savedEnv = process.env.KIRO_AUTH_TOKEN_PATH;
    (0, vitest_1.beforeEach)(() => {
        fs.mkdirSync(tmp, { recursive: true });
        delete process.env.KIRO_AUTH_TOKEN_PATH;
    });
    (0, vitest_1.afterEach)(() => {
        if (savedEnv === undefined)
            delete process.env.KIRO_AUTH_TOKEN_PATH;
        else
            process.env.KIRO_AUTH_TOKEN_PATH = savedEnv;
        try {
            fs.rmSync(tmp, { recursive: true });
        }
        catch { }
    });
    (0, vitest_1.it)('KIRO_AUTH_TOKEN_PATH override wins when file exists', () => {
        const f = path.join(tmp, 'explicit.json');
        fs.writeFileSync(f, JSON.stringify({ accessToken: 'x', refreshToken: 'r', expiresAt: isoIn(3600_000) }));
        process.env.KIRO_AUTH_TOKEN_PATH = f;
        (0, vitest_1.expect)((0, auth_resolver_js_1.discoverKiroTokenPath)({ forceRescan: true })).toBe(f);
    });
    (0, vitest_1.it)('points env at a SHA1-named kiro file with refreshToken', () => {
        const kiroFile = path.join(tmp, 'bbb1234sha1.json');
        fs.writeFileSync(kiroFile, JSON.stringify({
            accessToken: 'x', refreshToken: 'r', expiresAt: isoIn(3600_000), authMethod: 'IdC',
        }));
        process.env.KIRO_AUTH_TOKEN_PATH = kiroFile;
        (0, vitest_1.expect)((0, auth_resolver_js_1.discoverKiroTokenPath)({ forceRescan: true })).toBe(kiroFile);
    });
    (0, vitest_1.it)('missing override file falls through to default discovery (no throw)', () => {
        process.env.KIRO_AUTH_TOKEN_PATH = path.join(tmp, 'does-not-exist.json');
        // Should not throw; returns either a real discovered path on this machine or null.
        (0, vitest_1.expect)(() => (0, auth_resolver_js_1.discoverKiroTokenPath)({ forceRescan: true })).not.toThrow();
    });
});
// =============================================================================
// UT-RF-04: refresh request construction (social + idc) via https.request mock
// =============================================================================
(0, vitest_1.describe)('UT-RF-04: refresh request construction', () => {
    (0, vitest_1.afterEach)(() => {
        (0, token_refresh_js_1.setJsonPoster)(null);
    });
    function interceptHttps(respStatus, respBody) {
        const captured = { body: '' };
        (0, token_refresh_js_1.setJsonPoster)(async (url, headers, body) => {
            captured.url = url;
            captured.headers = headers;
            captured.body = body;
            return { status: respStatus, body: respBody };
        });
        return captured;
    }
    const idcToken = {
        accessToken: 'old-access',
        refreshToken: 'the-refresh-token',
        expiresAt: isoIn(60_000),
        region: 'ap-southeast-1',
        authMethod: 'IdC',
        clientId: 'client-id-123',
        clientSecret: 'client-secret-456',
    };
    const socialToken = {
        accessToken: 'old-access',
        refreshToken: 'the-refresh-token',
        expiresAt: isoIn(60_000),
        region: 'us-east-1',
        authMethod: 'social',
    };
    (0, vitest_1.it)('social refresh: correct URL host, headers, body', async () => {
        const cap = interceptHttps(200, JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 }));
        const result = await (0, token_refresh_js_1.refreshSocialToken)(socialToken);
        (0, vitest_1.expect)(cap.url).toBe('https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken');
        (0, vitest_1.expect)(cap.headers['User-Agent']).toMatch(/^KiroIDE-/);
        (0, vitest_1.expect)(cap.headers['Content-Type']).toBe('application/json');
        (0, vitest_1.expect)(cap.headers['host']).toBe('prod.us-east-1.auth.desktop.kiro.dev');
        (0, vitest_1.expect)(JSON.parse(cap.body)).toEqual({ refreshToken: 'the-refresh-token' });
        (0, vitest_1.expect)(result.accessToken).toBe('new-access');
        (0, vitest_1.expect)(result.refreshToken).toBe('new-refresh');
        (0, vitest_1.expect)(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
    });
    (0, vitest_1.it)('idc refresh: correct URL host, headers, body', async () => {
        const cap = interceptHttps(200, JSON.stringify({ accessToken: 'new-access', expiresIn: 3600 }));
        const result = await (0, token_refresh_js_1.refreshIdcToken)(idcToken);
        (0, vitest_1.expect)(cap.url).toBe('https://oidc.ap-southeast-1.amazonaws.com/token');
        (0, vitest_1.expect)(cap.headers['x-amz-user-agent']).toMatch(/KiroIDE/);
        (0, vitest_1.expect)(cap.headers['amz-sdk-request']).toBe('attempt=1; max=4');
        (0, vitest_1.expect)(cap.headers['host']).toBe('oidc.ap-southeast-1.amazonaws.com');
        const body = JSON.parse(cap.body);
        (0, vitest_1.expect)(body).toEqual({
            clientId: 'client-id-123',
            clientSecret: 'client-secret-456',
            refreshToken: 'the-refresh-token',
            grantType: 'refresh_token',
        });
        (0, vitest_1.expect)(result.accessToken).toBe('new-access');
        // refreshToken unchanged when server omits it
        (0, vitest_1.expect)(result.refreshToken).toBe('the-refresh-token');
    });
    (0, vitest_1.it)('social refresh: 400 invalid_grant → RefreshTokenExpiredError', async () => {
        interceptHttps(400, JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid refresh token provided' }));
        await (0, vitest_1.expect)((0, token_refresh_js_1.refreshSocialToken)(socialToken)).rejects.toBeInstanceOf(token_refresh_js_1.RefreshTokenExpiredError);
    });
    (0, vitest_1.it)('idc refresh: 500 → TokenRefreshError', async () => {
        interceptHttps(500, 'internal error');
        await (0, vitest_1.expect)((0, token_refresh_js_1.refreshIdcToken)(idcToken)).rejects.toBeInstanceOf(token_refresh_js_1.TokenRefreshError);
    });
    (0, vitest_1.it)('refresh without refreshToken → RefreshTokenExpiredError', async () => {
        await (0, vitest_1.expect)((0, token_refresh_js_1.refreshSocialToken)({ ...socialToken, refreshToken: undefined }))
            .rejects.toBeInstanceOf(token_refresh_js_1.RefreshTokenExpiredError);
    });
});
// =============================================================================
// UT-RF-05: ensureFreshKiroToken write-back preserves other fields
// =============================================================================
(0, vitest_1.describe)('UT-RF-05: ensureFreshKiroToken + write-back', () => {
    const tmp = path.join(os.tmpdir(), `kiro-wb-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    (0, vitest_1.beforeEach)(() => { fs.mkdirSync(tmp, { recursive: true }); });
    (0, vitest_1.afterEach)(() => {
        (0, token_refresh_js_1.setJsonPoster)(null);
        (0, auth_resolver_js_1.setCredentialPathOverride)(null);
        try {
            fs.rmSync(tmp, { recursive: true });
        }
        catch { }
    });
    (0, vitest_1.it)('refreshes an expired IdC token and writes back, preserving extra fields', async () => {
        const tokenFile = path.join(tmp, 'kiro-auth-token.json');
        const original = {
            accessToken: 'old-access',
            refreshToken: 'old-refresh',
            expiresAt: isoIn(60_000), // ~1min → expired (within 5min buffer)
            region: 'ap-southeast-1',
            authMethod: 'IdC',
            clientId: 'cid',
            clientSecret: 'csecret',
            provider: 'Enterprise',
            clientIdHash: 'deadbeef',
            customField: 'keep-me',
        };
        fs.writeFileSync(tokenFile, JSON.stringify(original, null, 2));
        (0, auth_resolver_js_1.setCredentialPathOverride)(tokenFile);
        // Mock the IdC refresh transport.
        (0, token_refresh_js_1.setJsonPoster)(async () => ({
            status: 200,
            body: JSON.stringify({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh', expiresIn: 3600 }),
        }));
        const fresh = await (0, auth_resolver_js_1.ensureFreshKiroToken)();
        (0, vitest_1.expect)(fresh?.accessToken).toBe('fresh-access');
        (0, vitest_1.expect)((0, auth_resolver_js_1.getActiveTokenPath)()).toBe(tokenFile);
        // File written back with new fields but preserving the custom one.
        const written = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
        (0, vitest_1.expect)(written.accessToken).toBe('fresh-access');
        (0, vitest_1.expect)(written.refreshToken).toBe('fresh-refresh');
        (0, vitest_1.expect)(written.customField).toBe('keep-me');
        (0, vitest_1.expect)(written.provider).toBe('Enterprise');
        (0, vitest_1.expect)(written.clientIdHash).toBe('deadbeef');
        (0, vitest_1.expect)(new Date(written.expiresAt).getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
    });
});
//# sourceMappingURL=token-refresh.vitest.js.map