"use strict";
/**
 * TokenManager — KSA-231
 * AWS SSO credential detection, in-memory storage, and auto-refresh.
 * Scans ~/.aws/sso/cache/ for valid tokens, selects best candidate,
 * and proactively refreshes before expiry using SSO OIDC CreateToken API.
 *
 * Security: Credentials exist ONLY in memory — never in settings, logs, or telemetry.
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
exports.KiroRefreshError = exports.KiroCredentialError = exports.TokenManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// ─── Mutex ────────────────────────────────────────────────────────────────────
class Mutex {
    locked = false;
    queue = [];
    async acquire() {
        if (!this.locked) {
            this.locked = true;
            return;
        }
        return new Promise(resolve => this.queue.push(resolve));
    }
    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        }
        else {
            this.locked = false;
        }
    }
    isLocked() {
        return this.locked;
    }
}
// ─── TokenManager ─────────────────────────────────────────────────────────────
class TokenManager {
    credentials = null;
    refreshTimer = null;
    refreshMutex = new Mutex();
    watcher = null;
    initialized = false;
    _onStatusChange = new vscode.EventEmitter();
    onStatusChange = this._onStatusChange.event;
    outputChannel;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    // ─── Public API ───────────────────────────────────────────────────────────
    async initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        const cacheDir = this.getCacheDirectory();
        if (!cacheDir || !fs.existsSync(cacheDir)) {
            this.setStatus("unavailable");
            this.log("WARN", "AWS SSO cache directory not found");
            return;
        }
        await this.scanAndSelectCredentials(cacheDir);
        this.startFileWatcher(cacheDir);
    }
    async getAccessToken() {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.credentials) {
            throw new KiroCredentialError("No Kiro credentials available. Please login via Kiro IDE.");
        }
        // Check if token is expired or about to expire (within 1 minute)
        const now = new Date();
        const bufferMs = 60_000;
        if (this.credentials.expiresAt.getTime() - now.getTime() < bufferMs) {
            await this.refreshToken();
        }
        if (!this.credentials || this.credentials.status === "expired") {
            throw new KiroCredentialError("Kiro token expired. Please re-login via Kiro IDE.");
        }
        return this.credentials.accessToken;
    }
    getRegion() {
        // Check VS Code settings override first
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        const regionOverride = config.get("kiroRegion", "");
        if (regionOverride) {
            return regionOverride;
        }
        return this.credentials?.region;
    }
    getStatus() {
        return this.credentials?.status ?? "no_credentials";
    }
    dispose() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = null;
        }
        // Zero out credential data in memory
        if (this.credentials) {
            this.credentials.accessToken = "";
            this.credentials.refreshToken = "";
            this.credentials.clientSecret = "";
            this.credentials.clientId = "";
            this.credentials = null;
        }
        this._onStatusChange.dispose();
    }
    // ─── Internal ─────────────────────────────────────────────────────────────
    getCacheDirectory() {
        const homeDir = os.homedir();
        const cacheDir = path.join(homeDir, ".aws", "sso", "cache");
        return cacheDir;
    }
    async scanAndSelectCredentials(cacheDir) {
        try {
            const files = fs.readdirSync(cacheDir).filter(f => f.endsWith(".json"));
            const candidates = [];
            for (const file of files) {
                const filePath = path.join(cacheDir, file);
                try {
                    const content = fs.readFileSync(filePath, "utf-8");
                    const parsed = JSON.parse(content);
                    const cred = this.parseCredentialFile(parsed, filePath);
                    if (cred) {
                        candidates.push(cred);
                    }
                }
                catch {
                    // Skip unparseable files
                }
            }
            if (candidates.length === 0) {
                this.setStatus("no_credentials");
                this.log("INFO", "No valid credentials found in SSO cache");
                return;
            }
            // Filter expired
            const now = new Date();
            const valid = candidates.filter(c => c.expiresAt.getTime() > now.getTime());
            if (valid.length === 0) {
                this.setStatus("expired");
                this.log("WARN", "All cached tokens are expired");
                return;
            }
            // Select best: prefer authMethod "idc", then most recent expiresAt
            valid.sort((a, b) => {
                if (a.authMethod === "idc" && b.authMethod !== "idc") {
                    return -1;
                }
                if (a.authMethod !== "idc" && b.authMethod === "idc") {
                    return 1;
                }
                return b.expiresAt.getTime() - a.expiresAt.getTime();
            });
            this.credentials = valid[0];
            this.credentials.status = "active";
            this.setStatus("active");
            this.scheduleRefresh();
            this.log("INFO", `Credential detected: region=${this.credentials.region}, expires in ${Math.round((this.credentials.expiresAt.getTime() - now.getTime()) / 60000)}min`);
        }
        catch (err) {
            this.log("ERROR", `Failed to scan credentials: ${err.message}`);
            this.setStatus("unavailable");
        }
    }
    parseCredentialFile(data, filePath) {
        // Validate required fields
        if (!data.accessToken || typeof data.accessToken !== "string" ||
            !data.expiresAt || typeof data.expiresAt !== "string" ||
            !data.region || typeof data.region !== "string" ||
            !data.refreshToken || typeof data.refreshToken !== "string" ||
            !data.clientId || typeof data.clientId !== "string" ||
            !data.clientSecret || typeof data.clientSecret !== "string") {
            return null;
        }
        const expiresAt = new Date(data.expiresAt);
        if (isNaN(expiresAt.getTime())) {
            return null;
        }
        // Validate region format
        if (!/^[a-z]{2}-[a-z]+-\d+$/.test(data.region)) {
            return null;
        }
        return {
            accessToken: data.accessToken,
            expiresAt,
            region: data.region,
            refreshToken: data.refreshToken,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            authMethod: data.authMethod || undefined,
            status: "active",
            sourceFile: filePath,
        };
    }
    scheduleRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        if (!this.credentials) {
            return;
        }
        // Refresh 5 minutes before expiry
        const now = Date.now();
        const expiresAt = this.credentials.expiresAt.getTime();
        const refreshAt = expiresAt - 5 * 60_000;
        const delay = Math.max(refreshAt - now, 10_000); // At least 10s from now
        this.refreshTimer = setTimeout(() => this.refreshToken(), delay);
    }
    async refreshToken() {
        await this.refreshMutex.acquire();
        try {
            if (!this.credentials) {
                return;
            }
            // Double-check: if another call already refreshed, skip
            const now = new Date();
            const bufferMs = 4 * 60_000; // 4 min buffer (less than 5 to avoid tight race)
            if (this.credentials.expiresAt.getTime() - now.getTime() > bufferMs) {
                return; // Already refreshed by a concurrent call
            }
            this.credentials.status = "refreshing";
            this._onStatusChange.fire("refreshing");
            this.log("INFO", "Refreshing token (attempt 1/3)");
            let lastError = null;
            const delays = [1000, 2000, 4000];
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const response = await fetch(`https://oidc.${this.credentials.region}.amazonaws.com/token`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            clientId: this.credentials.clientId,
                            clientSecret: this.credentials.clientSecret,
                            grantType: "refresh_token",
                            refreshToken: this.credentials.refreshToken,
                        }),
                        signal: AbortSignal.timeout(10_000),
                    });
                    if (response.status === 400) {
                        const errorBody = await response.json().catch(() => ({}));
                        if (errorBody.error === "invalid_grant") {
                            // Refresh token itself is expired — cannot recover
                            this.credentials.status = "expired";
                            this.setStatus("expired");
                            this.log("WARN", "Refresh token expired (invalid_grant). Re-login required.");
                            vscode.window.showWarningMessage("Kiro session expired. Please re-login via Kiro IDE.", "Open Kiro IDE");
                            return;
                        }
                        throw new Error(`SSO OIDC returned 400: ${JSON.stringify(errorBody)}`);
                    }
                    if (!response.ok) {
                        throw new Error(`SSO OIDC returned ${response.status}`);
                    }
                    const result = await response.json();
                    // Update credentials in memory
                    this.credentials.accessToken = result.accessToken;
                    this.credentials.refreshToken = result.refreshToken;
                    this.credentials.expiresAt = new Date(Date.now() + result.expiresIn * 1000);
                    this.credentials.status = "active";
                    this.setStatus("active");
                    this.log("INFO", `Token refreshed. Expires at ${this.credentials.expiresAt.toISOString()}`);
                    // Write back to cache file (best-effort)
                    this.writeBackToCache();
                    // Reschedule next refresh
                    this.scheduleRefresh();
                    return;
                }
                catch (err) {
                    lastError = err;
                    if (attempt < 2) {
                        this.log("WARN", `Refresh failed (attempt ${attempt + 1}/3): ${lastError.message}`);
                        await this.sleep(delays[attempt]);
                    }
                }
            }
            // All retries failed
            this.log("ERROR", `Token refresh failed after 3 attempts: ${lastError?.message}`);
            this.credentials.status = "expired";
            this.setStatus("expired");
            vscode.window.showWarningMessage("Cannot refresh Kiro token. Check network connection.", "Retry").then(action => {
                if (action === "Retry") {
                    this.refreshToken();
                }
            });
            // Schedule retry in 30 seconds
            this.refreshTimer = setTimeout(() => this.refreshToken(), 30_000);
        }
        finally {
            this.refreshMutex.release();
        }
    }
    writeBackToCache() {
        if (!this.credentials) {
            return;
        }
        try {
            const content = fs.readFileSync(this.credentials.sourceFile, "utf-8");
            const data = JSON.parse(content);
            data.accessToken = this.credentials.accessToken;
            data.refreshToken = this.credentials.refreshToken;
            data.expiresAt = this.credentials.expiresAt.toISOString();
            fs.writeFileSync(this.credentials.sourceFile, JSON.stringify(data, null, 2), "utf-8");
        }
        catch (err) {
            this.log("WARN", `Write-back to cache failed: ${err.message}`);
        }
    }
    startFileWatcher(cacheDir) {
        const pattern = new vscode.RelativePattern(vscode.Uri.file(cacheDir), "*.json");
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const rescan = () => {
            this.log("INFO", "Cache directory changed — rescanning credentials");
            this.scanAndSelectCredentials(cacheDir);
        };
        this.watcher.onDidCreate(rescan);
        this.watcher.onDidChange(rescan);
    }
    setStatus(status) {
        if (this.credentials) {
            this.credentials.status = status;
        }
        this._onStatusChange.fire(status);
    }
    log(level, message) {
        this.outputChannel.appendLine(`[${level}] TokenManager: ${message}`);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TokenManager = TokenManager;
// ─── Error Classes ────────────────────────────────────────────────────────────
class KiroCredentialError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "KiroCredentialError";
    }
}
exports.KiroCredentialError = KiroCredentialError;
class KiroRefreshError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "KiroRefreshError";
    }
}
exports.KiroRefreshError = KiroRefreshError;
//# sourceMappingURL=token-manager.js.map