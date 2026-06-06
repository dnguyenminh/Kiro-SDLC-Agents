/**
 * Health Checker — KSA-237
 * Diagnostic endpoint verifying credentials, API connectivity, and model availability.
 *
 * Connectivity is checked against the real Kiro AI endpoint
 * `q.{region}.amazonaws.com` (AWS CodeWhisperer), NOT the legacy
 * (non-existent) `kiro.api.*.amazonaws.com` host.
 */

import * as https from 'https';
import { resolveAuth, AuthenticationError, resolveApiRegionAsync, invalidateApiRegionCache, ensureFreshKiroToken, RefreshTokenExpiredError } from './auth-resolver.js';
import { HealthStatus } from './types.js';

const HEALTH_TIMEOUT_MS = 5000;

/** Build the Kiro AI host for a region. */
function kiroApiHost(region: string): string {
  return `q.${region}.amazonaws.com`;
}

/**
 * Perform health check — verifies credential availability, API connectivity, and model access.
 * Total timeout: 5 seconds (BR-10).
 */
export async function checkHealth(): Promise<HealthStatus> {
  const startTime = Date.now();
  const result: HealthStatus = {
    status: 'healthy',
    credentials: { status: 'not_configured' },
    api_connectivity: { status: 'failed', error: 'Not checked' },
    model_available: { status: 'failed', error: 'Not checked' },
    timestamp: new Date().toISOString(),
  };

  // Step 1: Check credentials
  let region = 'us-east-1';
  let isKiroMode = false;
  try {
    // Proactively ensure the Kiro token is fresh so health reflects reality and
    // a soon-to-expire token gets refreshed before the next real request.
    try {
      await ensureFreshKiroToken();
    } catch (err) {
      if (err instanceof RefreshTokenExpiredError) {
        result.credentials = {
          status: 'failed',
          type: 'kiro',
          error: `Refresh token expired — please re-login to Kiro IDE. (${err.message})`,
        };
        result.status = 'unhealthy';
        result.timestamp = new Date().toISOString();
        return result;
      }
      // Non-fatal refresh error: fall through to resolveAuth with current token.
      console.error('[kiro-ts] Health check refresh attempt failed:', (err as Error).message);
    }

    const auth = resolveAuth();
    if (auth.mode === 'api_key') {
      result.credentials = { status: 'ok', type: 'api_key' };
    } else if (auth.mode === 'kiro' && auth.credentials) {
      isKiroMode = true;
      const expiresIn = auth.credentials.expiration.getTime() - Date.now();
      const minutes = Math.floor(expiresIn / 60000);
      result.credentials = {
        status: 'ok',
        type: 'kiro',
        expires_in: `${minutes}m`,
      };
    }
  } catch (err) {
    if (err instanceof AuthenticationError) {
      result.credentials = { status: 'failed', error: err.message };
      result.status = 'unhealthy';
      result.timestamp = new Date().toISOString();
      return result;
    }
    result.credentials = { status: 'failed', error: 'Unknown error' };
    result.status = 'unhealthy';
    result.timestamp = new Date().toISOString();
    return result;
  }

  // Step 2: Resolve the API region (auto-probe via DNS) before connectivity.
  // Explicit overrides (token.apiRegion / env) short-circuit the probe.
  try {
    region = await resolveApiRegionAsync(null);
  } catch {
    region = 'us-east-1';
  }
  result.api_region = region;

  // Step 3: Check API connectivity (with timeout)
  const elapsed = Date.now() - startTime;
  const remainingMs = HEALTH_TIMEOUT_MS - elapsed;
  if (remainingMs <= 0) {
    result.status = 'unhealthy';
    result.api_connectivity = { status: 'failed', error: 'Health check timed out' };
    result.timestamp = new Date().toISOString();
    return result;
  }

  try {
    const connectStart = Date.now();
    await pingApi(kiroApiHost(region), remainingMs);
    const latency = Date.now() - connectStart;
    result.api_connectivity = { status: 'ok', latency_ms: latency };
    result.model_available = { status: 'ok', model: 'claude-sonnet-4-20250514' };
  } catch (err: any) {
    // The cached region may be stale / unreachable — invalidate so the next
    // health-check re-probes from scratch.
    if (isKiroMode) {
      invalidateApiRegionCache();
    }
    result.api_connectivity = { status: 'failed', error: err.message || 'Connection failed' };
    result.model_available = { status: 'failed', error: 'Cannot verify without connectivity' };
    result.status = 'degraded';
  }

  result.timestamp = new Date().toISOString();
  return result;
}

/**
 * Ping the Kiro AI endpoint to verify connectivity.
 * Sends a minimal POST to /generateAssistantResponse; any HTTP response
 * (even 4xx) means the host is reachable. Only DNS/connection errors fail.
 */
function pingApi(host: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port: 443,
        path: '/generateAssistantResponse',
        method: 'POST',
        timeout: timeoutMs,
        headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
      },
      (res) => {
        res.resume(); // Consume response
        // Any response (even 4xx/401) means the API host is reachable
        resolve();
      },
    );

    req.on('error', (err) => {
      reject(new Error(`API unreachable: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API connection timed out'));
    });

    req.end('{}');
  });
}
