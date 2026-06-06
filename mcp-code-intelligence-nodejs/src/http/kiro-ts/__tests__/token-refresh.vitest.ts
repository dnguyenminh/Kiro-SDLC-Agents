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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  isTokenExpired,
  isTokenExpiringSoon,
  isIdcToken,
  resolveAuthRegion,
  refreshSocialToken,
  refreshIdcToken,
  setJsonPoster,
  RefreshTokenExpiredError,
  TokenRefreshError,
} from '../token-refresh.js';
import {
  discoverKiroTokenPath,
  setCredentialPathOverride,
  ensureFreshKiroToken,
  getActiveTokenPath,
} from '../auth-resolver.js';
import type { KiroSSOToken } from '../auth-resolver.js';

const isoIn = (ms: number) => new Date(Date.now() + ms).toISOString();

// =============================================================================
// UT-RF-01: Expiry detection thresholds
// =============================================================================
describe('UT-RF-01: isTokenExpired / isTokenExpiringSoon', () => {
  it('token expiring in 2min counts as expired AND expiring soon', () => {
    const t = { expiresAt: isoIn(2 * 60 * 1000) };
    expect(isTokenExpired(t)).toBe(true);
    expect(isTokenExpiringSoon(t)).toBe(true);
  });

  it('token expiring in 7min is NOT expired but IS expiring soon', () => {
    const t = { expiresAt: isoIn(7 * 60 * 1000) };
    expect(isTokenExpired(t)).toBe(false);
    expect(isTokenExpiringSoon(t)).toBe(true);
  });

  it('token expiring in 30min is neither expired nor expiring soon', () => {
    const t = { expiresAt: isoIn(30 * 60 * 1000) };
    expect(isTokenExpired(t)).toBe(false);
    expect(isTokenExpiringSoon(t)).toBe(false);
  });

  it('malformed expiresAt is treated as expired', () => {
    expect(isTokenExpired({ expiresAt: 'not-a-date' })).toBe(true);
    expect(isTokenExpiringSoon({ expiresAt: 'not-a-date' })).toBe(true);
  });
});

// =============================================================================
// UT-RF-02: IdC vs social detection + auth region
// =============================================================================
describe('UT-RF-02: isIdcToken / resolveAuthRegion', () => {
  const base: KiroSSOToken = {
    accessToken: 'a', expiresAt: isoIn(3600_000), region: 'ap-southeast-1',
  };

  it('authMethod=social → social flow even with client creds', () => {
    expect(isIdcToken({ ...base, authMethod: 'social', clientId: 'c', clientSecret: 's' })).toBe(false);
  });

  it('authMethod=IdC with client creds → idc flow', () => {
    expect(isIdcToken({ ...base, authMethod: 'IdC', clientId: 'c', clientSecret: 's' })).toBe(true);
  });

  it('authMethod=IdC WITHOUT client creds → not treated as idc-capable', () => {
    expect(isIdcToken({ ...base, authMethod: 'IdC' })).toBe(false);
  });

  it('no authMethod but client creds present → idc flow inferred', () => {
    expect(isIdcToken({ ...base, clientId: 'c', clientSecret: 's' })).toBe(true);
  });

  it('authRegion > region > default', () => {
    expect(resolveAuthRegion({ ...base, authRegion: 'eu-central-1' })).toBe('eu-central-1');
    expect(resolveAuthRegion({ ...base })).toBe('ap-southeast-1');
    expect(resolveAuthRegion({ accessToken: 'a', expiresAt: isoIn(1), region: '' })).toBe('us-east-1');
  });
});

// =============================================================================
// UT-RF-03: discoverKiroTokenPath override mechanism
// =============================================================================
describe('UT-RF-03: discoverKiroTokenPath', () => {
  const tmp = path.join(os.tmpdir(), `kiro-discover-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const savedEnv = process.env.KIRO_AUTH_TOKEN_PATH;

  beforeEach(() => {
    fs.mkdirSync(tmp, { recursive: true });
    delete process.env.KIRO_AUTH_TOKEN_PATH;
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.KIRO_AUTH_TOKEN_PATH;
    else process.env.KIRO_AUTH_TOKEN_PATH = savedEnv;
    try { fs.rmSync(tmp, { recursive: true }); } catch {}
  });

  it('KIRO_AUTH_TOKEN_PATH override wins when file exists', () => {
    const f = path.join(tmp, 'explicit.json');
    fs.writeFileSync(f, JSON.stringify({ accessToken: 'x', refreshToken: 'r', expiresAt: isoIn(3600_000) }));
    process.env.KIRO_AUTH_TOKEN_PATH = f;
    expect(discoverKiroTokenPath({ forceRescan: true })).toBe(f);
  });

  it('points env at a SHA1-named kiro file with refreshToken', () => {
    const kiroFile = path.join(tmp, 'bbb1234sha1.json');
    fs.writeFileSync(kiroFile, JSON.stringify({
      accessToken: 'x', refreshToken: 'r', expiresAt: isoIn(3600_000), authMethod: 'IdC',
    }));
    process.env.KIRO_AUTH_TOKEN_PATH = kiroFile;
    expect(discoverKiroTokenPath({ forceRescan: true })).toBe(kiroFile);
  });

  it('missing override file falls through to default discovery (no throw)', () => {
    process.env.KIRO_AUTH_TOKEN_PATH = path.join(tmp, 'does-not-exist.json');
    // Should not throw; returns either a real discovered path on this machine or null.
    expect(() => discoverKiroTokenPath({ forceRescan: true })).not.toThrow();
  });
});

// =============================================================================
// UT-RF-04: refresh request construction (social + idc) via https.request mock
// =============================================================================
describe('UT-RF-04: refresh request construction', () => {
  afterEach(() => {
    setJsonPoster(null);
  });

  function interceptHttps(respStatus: number, respBody: string) {
    const captured: { url?: string; headers?: Record<string, string>; body: string } = { body: '' };
    setJsonPoster(async (url, headers, body) => {
      captured.url = url;
      captured.headers = headers;
      captured.body = body;
      return { status: respStatus, body: respBody };
    });
    return captured;
  }

  const idcToken: KiroSSOToken = {
    accessToken: 'old-access',
    refreshToken: 'the-refresh-token',
    expiresAt: isoIn(60_000),
    region: 'ap-southeast-1',
    authMethod: 'IdC',
    clientId: 'client-id-123',
    clientSecret: 'client-secret-456',
  };

  const socialToken: KiroSSOToken = {
    accessToken: 'old-access',
    refreshToken: 'the-refresh-token',
    expiresAt: isoIn(60_000),
    region: 'us-east-1',
    authMethod: 'social',
  };

  it('social refresh: correct URL host, headers, body', async () => {
    const cap = interceptHttps(200, JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 }));
    const result = await refreshSocialToken(socialToken);

    expect(cap.url).toBe('https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken');
    expect(cap.headers!['User-Agent']).toMatch(/^KiroIDE-/);
    expect(cap.headers!['Content-Type']).toBe('application/json');
    expect(cap.headers!['host']).toBe('prod.us-east-1.auth.desktop.kiro.dev');
    expect(JSON.parse(cap.body)).toEqual({ refreshToken: 'the-refresh-token' });

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
  });

  it('idc refresh: correct URL host, headers, body', async () => {
    const cap = interceptHttps(200, JSON.stringify({ accessToken: 'new-access', expiresIn: 3600 }));
    const result = await refreshIdcToken(idcToken);

    expect(cap.url).toBe('https://oidc.ap-southeast-1.amazonaws.com/token');
    expect(cap.headers!['x-amz-user-agent']).toMatch(/KiroIDE/);
    expect(cap.headers!['amz-sdk-request']).toBe('attempt=1; max=4');
    expect(cap.headers!['host']).toBe('oidc.ap-southeast-1.amazonaws.com');
    const body = JSON.parse(cap.body);
    expect(body).toEqual({
      clientId: 'client-id-123',
      clientSecret: 'client-secret-456',
      refreshToken: 'the-refresh-token',
      grantType: 'refresh_token',
    });
    expect(result.accessToken).toBe('new-access');
    // refreshToken unchanged when server omits it
    expect(result.refreshToken).toBe('the-refresh-token');
  });

  it('social refresh: 400 invalid_grant → RefreshTokenExpiredError', async () => {
    interceptHttps(400, JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid refresh token provided' }));
    await expect(refreshSocialToken(socialToken)).rejects.toBeInstanceOf(RefreshTokenExpiredError);
  });

  it('idc refresh: 500 → TokenRefreshError', async () => {
    interceptHttps(500, 'internal error');
    await expect(refreshIdcToken(idcToken)).rejects.toBeInstanceOf(TokenRefreshError);
  });

  it('refresh without refreshToken → RefreshTokenExpiredError', async () => {
    await expect(refreshSocialToken({ ...socialToken, refreshToken: undefined }))
      .rejects.toBeInstanceOf(RefreshTokenExpiredError);
  });
});

// =============================================================================
// UT-RF-05: ensureFreshKiroToken write-back preserves other fields
// =============================================================================
describe('UT-RF-05: ensureFreshKiroToken + write-back', () => {
  const tmp = path.join(os.tmpdir(), `kiro-wb-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  beforeEach(() => { fs.mkdirSync(tmp, { recursive: true }); });
  afterEach(() => {
    setJsonPoster(null);
    setCredentialPathOverride(null);
    try { fs.rmSync(tmp, { recursive: true }); } catch {}
  });

  it('refreshes an expired IdC token and writes back, preserving extra fields', async () => {
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
    setCredentialPathOverride(tokenFile);

    // Mock the IdC refresh transport.
    setJsonPoster(async () => ({
      status: 200,
      body: JSON.stringify({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh', expiresIn: 3600 }),
    }));

    const fresh = await ensureFreshKiroToken();
    expect(fresh?.accessToken).toBe('fresh-access');
    expect(getActiveTokenPath()).toBe(tokenFile);

    // File written back with new fields but preserving the custom one.
    const written = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
    expect(written.accessToken).toBe('fresh-access');
    expect(written.refreshToken).toBe('fresh-refresh');
    expect(written.customField).toBe('keep-me');
    expect(written.provider).toBe('Enterprise');
    expect(written.clientIdHash).toBe('deadbeef');
    expect(new Date(written.expiresAt).getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
  });
});
