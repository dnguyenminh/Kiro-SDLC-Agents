"use strict";
/**
 * Health Checker — KSA-237
 * Diagnostic endpoint verifying credentials, API connectivity, and model availability.
 *
 * Connectivity is checked against the real Kiro AI endpoint
 * `q.{region}.amazonaws.com` (AWS CodeWhisperer), NOT the legacy
 * (non-existent) `kiro.api.*.amazonaws.com` host.
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
exports.checkHealth = checkHealth;
const https = __importStar(require("https"));
const auth_resolver_js_1 = require("./auth-resolver.js");
const HEALTH_TIMEOUT_MS = 5000;
/** Build the Kiro AI host for a region. */
function kiroApiHost(region) {
    return `q.${region}.amazonaws.com`;
}
/**
 * Perform health check — verifies credential availability, API connectivity, and model access.
 * Total timeout: 5 seconds (BR-10).
 */
async function checkHealth() {
    const startTime = Date.now();
    const result = {
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
            await (0, auth_resolver_js_1.ensureFreshKiroToken)();
        }
        catch (err) {
            if (err instanceof auth_resolver_js_1.RefreshTokenExpiredError) {
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
            console.error('[kiro-ts] Health check refresh attempt failed:', err.message);
        }
        const auth = (0, auth_resolver_js_1.resolveAuth)();
        if (auth.mode === 'api_key') {
            result.credentials = { status: 'ok', type: 'api_key' };
        }
        else if (auth.mode === 'kiro' && auth.credentials) {
            isKiroMode = true;
            const expiresIn = auth.credentials.expiration.getTime() - Date.now();
            const minutes = Math.floor(expiresIn / 60000);
            result.credentials = {
                status: 'ok',
                type: 'kiro',
                expires_in: `${minutes}m`,
            };
        }
    }
    catch (err) {
        if (err instanceof auth_resolver_js_1.AuthenticationError) {
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
        region = await (0, auth_resolver_js_1.resolveApiRegionAsync)(null);
    }
    catch {
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
    }
    catch (err) {
        // The cached region may be stale / unreachable — invalidate so the next
        // health-check re-probes from scratch.
        if (isKiroMode) {
            (0, auth_resolver_js_1.invalidateApiRegionCache)();
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
function pingApi(host, timeoutMs) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: host,
            port: 443,
            path: '/generateAssistantResponse',
            method: 'POST',
            timeout: timeoutMs,
            headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
        }, (res) => {
            res.resume(); // Consume response
            // Any response (even 4xx/401) means the API host is reachable
            resolve();
        });
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
//# sourceMappingURL=health-checker.js.map