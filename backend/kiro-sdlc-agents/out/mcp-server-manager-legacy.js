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
exports.McpServerManager = void 0;
exports.getNonce = getNonce;
/**
 * McpServerManager — Spawns and manages the bundled MCP Code Intelligence server.
 * The extension IS the MCP server: it spawns mcp-server/http-entry.js as a child process,
 * detects the listening port from stderr, and provides invokeTool() for JSON-RPC calls.
 */
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const types_1 = require("./types");
class McpServerManager {
    extensionPath;
    workspaceFolder;
    outputChannel;
    _status = "stopped";
    _port = null;
    _pid = null;
    childProc = null;
    restartCount = 0;
    isDisposing = false;
    externalServer = false;
    nativeAddonManager;
    onnxAddonManager;
    // KSA-112: Track ERR_DLOPEN_FAILED for auto-recovery
    dlopenErrorDetected = false;
    mismatchRecoveryAttempted = false;
    _onStatusChange = new vscode.EventEmitter();
    onStatusChange = this._onStatusChange.event;
    constructor(extensionPath, workspaceFolder, outputChannel) {
        this.extensionPath = extensionPath;
        this.workspaceFolder = workspaceFolder;
        this.outputChannel = outputChannel;
    }
    /**
     * Set the NativeAddonManager for prebuilt binary resolution.
     */
    setNativeAddonManager(manager) {
        this.nativeAddonManager = manager;
    }
    /**
     * Set the OnnxAddonManager for prebuilt ONNX Runtime binary resolution.
     */
    setOnnxAddonManager(manager) {
        this.onnxAddonManager = manager;
    }
    get status() {
        return this._status;
    }
    get pid() {
        return this._pid;
    }
    get port() {
        return this._port;
    }
    /** Viewer is served on the same port as MCP (http-entry.js proxies it). */
    get viewerPort() {
        return this._port;
    }
    // ─── Public API ────────────────────────────────────────────────────────────
    /**
     * Spawn the bundled MCP server process.
     * If the configured port is already listening, connect directly without spawning.
     */
    async spawn() {
        if (this._status === "running") {
            return;
        }
        this.setStatus("starting");
        const configuredPort = this.getConfiguredPort();
        // Check if port is already in use → external server running
        if (await this.isPortListening(configuredPort)) {
            this.outputChannel.appendLine(`[MCP] Port ${configuredPort} already in use — connecting to existing server.`);
            this._port = configuredPort;
            this._pid = null;
            this.externalServer = true;
            this.setStatus("running");
            this.updateMcpJson();
            return;
        }
        // Ensure native addon is available (KSA-175: Runtime Self-Download)
        // KSA-112: Detect and recover from NODE_MODULE_VERSION mismatch
        let nativeBindingPath;
        if (this.nativeAddonManager) {
            const addonPath = await this.nativeAddonManager.ensure();
            if (!addonPath) {
                this.setStatus("stopped");
                this.outputChannel.appendLine("[MCP] Native addon unavailable. Server not started.");
                return;
            }
            nativeBindingPath = addonPath;
            this.outputChannel.appendLine(`[MCP] Native addon resolved: ${addonPath}`);
        }
        // Ensure ONNX Runtime is available (optional — embedding features)
        let onnxRuntimePath;
        if (this.onnxAddonManager) {
            const onnxPath = await this.onnxAddonManager.ensure();
            if (onnxPath) {
                onnxRuntimePath = onnxPath;
                this.outputChannel.appendLine(`[MCP] ONNX Runtime resolved: ${onnxPath}`);
            }
            else {
                this.outputChannel.appendLine("[MCP] ONNX Runtime unavailable — embedding features disabled.");
            }
        }
        // Verify bundle exists
        const entryPath = path.join(this.extensionPath, "mcp-server", "http-entry.js");
        if (!fs.existsSync(entryPath)) {
            this.setStatus("stopped");
            throw new types_1.McpBundleMissingError();
        }
        const configPath = this.getConfigPath();
        // Build NODE_PATH so onnxruntime-node can resolve onnxruntime-common (sibling dir)
        const nodePath = onnxRuntimePath
            ? [path.dirname(onnxRuntimePath), process.env.NODE_PATH].filter(Boolean).join(path.delimiter)
            : process.env.NODE_PATH;
        // Spawn child process using the same Node binary as the extension host (Kiro's bundled node).
        // Using process.execPath ensures we don't accidentally use a different system node version.
        const nodeExe = process.execPath;
        this.outputChannel.appendLine(`[MCP] Using Node runtime: ${nodeExe} (v${process.versions.node})`);
        const child = (0, child_process_1.spawn)(nodeExe, [entryPath, "--port", String(configuredPort), "--config", configPath], {
            cwd: this.workspaceFolder,
            env: {
                ...process.env,
                NODE_ENV: "production",
                CODE_INTEL_VIEWER_PORT: "-1",
                ...(nativeBindingPath ? { BETTER_SQLITE3_BINDING: nativeBindingPath } : {}),
                ...(onnxRuntimePath ? { ONNX_RUNTIME_PATH: onnxRuntimePath } : {}),
                ...(nodePath ? { NODE_PATH: nodePath } : {}),
            },
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
        });
        this.childProc = child;
        this._pid = child.pid ?? null;
        // Write PID file
        this.writePidFile();
        // Wait for port detection from stderr
        const detectedPort = await this.waitForPort(child, configuredPort);
        this._port = detectedPort;
        this.externalServer = false;
        this.setStatus("running");
        this.outputChannel.appendLine(`[MCP] Server running on port ${detectedPort} (PID: ${this._pid})`);
        // Update mcp.json with httpStream URL
        this.updateMcpJson();
        // Handle crash / exit
        child.on("exit", (code, signal) => {
            if (this.isDisposing) {
                return;
            }
            this.outputChannel.appendLine(`[MCP] Server exited (code=${code}, signal=${signal})`);
            this._pid = null;
            this._port = null;
            this.childProc = null;
            this.removePidFile();
            // KSA-112: Check if crash was due to MODULE_VERSION mismatch
            if (this.dlopenErrorDetected && this.nativeAddonManager && !this.mismatchRecoveryAttempted) {
                this.mismatchRecoveryAttempted = true;
                this.dlopenErrorDetected = false;
                this.outputChannel.appendLine("[MCP] ⚠️ ERR_DLOPEN_FAILED detected — NODE_MODULE_VERSION mismatch.");
                this.outputChannel.appendLine("[MCP] Auto-recovering: deleting cached addon and re-downloading for correct runtime...");
                this.handleModuleVersionMismatch();
                return;
            }
            this.dlopenErrorDetected = false;
            if (this.restartCount < types_1.SERVER_CONSTANTS.MAX_RESTARTS) {
                this.setStatus("crashed");
                const backoff = types_1.SERVER_CONSTANTS.BACKOFF_MS[this.restartCount] ?? 30000;
                this.restartCount++;
                this.outputChannel.appendLine(`[MCP] Crash recovery ${this.restartCount}/${types_1.SERVER_CONSTANTS.MAX_RESTARTS} — retrying in ${backoff}ms`);
                setTimeout(() => {
                    if (!this.isDisposing) {
                        this.spawn().catch((err) => {
                            this.outputChannel.appendLine(`[MCP] Restart failed: ${err.message}`);
                        });
                    }
                }, backoff);
            }
            else {
                this.setStatus("crashed");
                this.outputChannel.appendLine("[MCP] Max restarts reached. Server will not auto-restart.");
            }
        });
        // Pipe stderr to output channel (after port detection)
        // KSA-112: Also detect ERR_DLOPEN_FAILED for auto-recovery
        child.stderr?.on("data", (chunk) => {
            const text = chunk.toString();
            try {
                this.outputChannel.appendLine(text.trimEnd());
            }
            catch (e) {
                console.error("[kiro-sdlc] OutputChannel write failed:", e.message);
            }
            if (text.includes("ERR_DLOPEN_FAILED") || text.includes("NODE_MODULE_VERSION")) {
                this.dlopenErrorDetected = true;
            }
        });
    }
    /**
     * Kill the server process.
     */
    async kill() {
        if (this.externalServer) {
            this._port = null;
            this.setStatus("stopped");
            this.outputChannel.appendLine("[MCP] Disconnected from external server.");
            return;
        }
        if (!this.childProc && !this._pid) {
            this.setStatus("stopped");
            return;
        }
        this.outputChannel.appendLine("[MCP] Killing server...");
        try {
            if (process.platform === "win32" && this._pid) {
                (0, child_process_1.execSync)(`taskkill /PID ${this._pid} /T /F`, { timeout: types_1.SERVER_CONSTANTS.KILL_TIMEOUT_MS });
            }
            else if (this.childProc) {
                this.childProc.kill("SIGTERM");
            }
        }
        catch (err) {
            this.outputChannel.appendLine(`[MCP] Kill warning: ${err.message}`);
        }
        this.childProc = null;
        this._pid = null;
        this._port = null;
        this.removePidFile();
        this.setStatus("stopped");
    }
    /**
     * Restart: kill then spawn.
     */
    async restart() {
        this.outputChannel.appendLine("[MCP] Restarting...");
        this.restartCount = 0; // manual restart resets counter
        await this.kill();
        await this.spawn();
    }
    /**
     * Invoke an MCP tool via HTTP POST to /mcp.
     */
    async invokeTool(name, args) {
        if (this._status !== "running" || !this._port) {
            throw new types_1.McpServerNotRunningError();
        }
        const request = {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: { name, arguments: args },
        };
        const url = `http://127.0.0.1:${this._port}/mcp`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), types_1.SERVER_CONSTANTS.REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = (await response.json());
            if (data.error) {
                throw new Error(`MCP error (${data.error.code}): ${data.error.message}`);
            }
            return data.result?.content?.[0]?.text ?? "";
        }
        catch (err) {
            clearTimeout(timeout);
            if (err.name === "AbortError") {
                throw new types_1.McpTimeoutError(name, types_1.SERVER_CONSTANTS.REQUEST_TIMEOUT_MS);
            }
            throw err;
        }
    }
    /**
     * Dispose — kill server and clean up.
     */
    dispose() {
        this.isDisposing = true;
        this.kill().catch(() => { });
        this._onStatusChange.dispose();
    }
    /**
     * KSA-112: Handle NODE_MODULE_VERSION mismatch.
     * Deletes the wrong cached addon and re-downloads for the correct runtime version.
     * Then restarts the server.
     */
    async handleModuleVersionMismatch() {
        this.setStatus("starting");
        try {
            if (this.nativeAddonManager) {
                this.outputChannel.appendLine("[MCP] Deleting mismatched native addon cache...");
                const newPath = await this.nativeAddonManager.redownload();
                if (newPath) {
                    this.outputChannel.appendLine(`[MCP] ✅ Re-downloaded correct addon: ${newPath}`);
                    // Reset restart count — this is a recovery, not a crash loop
                    this.restartCount = 0;
                    await this.spawn();
                    return;
                }
            }
            // Recovery failed — report to user
            this.setStatus("crashed");
            this.outputChannel.appendLine("[MCP] ❌ Auto-recovery failed. Please restart Kiro IDE.");
            vscode.window.showErrorMessage("MCP server crashed due to Node.js version mismatch (ERR_DLOPEN_FAILED). " +
                "Auto-recovery failed. Try: 1) Restart Kiro IDE, or 2) Delete native addon cache manually.", "Retry", "Open Output").then((action) => {
                if (action === "Retry") {
                    this.mismatchRecoveryAttempted = false;
                    this.restartCount = 0;
                    this.spawn().catch(() => { });
                }
                else if (action === "Open Output") {
                    this.outputChannel.show();
                }
            });
        }
        catch (err) {
            this.setStatus("crashed");
            this.outputChannel.appendLine(`[MCP] Recovery error: ${err.message}`);
        }
    }
    // ─── Private Methods ───────────────────────────────────────────────────────
    setStatus(status) {
        if (this._status !== status) {
            this._status = status;
            this._onStatusChange.fire(status);
        }
    }
    getConfiguredPort() {
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        return config.get("mcpServerPort", 9181);
    }
    getConfigPath() {
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        const relative = config.get("configPath", ".code-intel/orchestration.json");
        return path.resolve(this.workspaceFolder, relative);
    }
    /**
     * Check if a port is already listening (TCP connect test).
     */
    isPortListening(port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2000);
            socket.on("connect", () => {
                socket.destroy();
                resolve(true);
            });
            socket.on("timeout", () => {
                socket.destroy();
                resolve(false);
            });
            socket.on("error", () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, "127.0.0.1");
        });
    }
    /**
     * Wait for the server to print its listening port on stderr.
     * Pattern: [mcp-http] Listening on port (\d+)
     */
    waitForPort(child, fallbackPort) {
        return new Promise((resolve, reject) => {
            const portRegex = /\[mcp-http\] Listening on port (\d+)/;
            let resolved = false;
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    // Timeout — assume configured port if process is still alive
                    if (child.exitCode === null) {
                        resolve(fallbackPort);
                    }
                    else {
                        reject(new types_1.McpSpawnError("Server did not start within timeout."));
                    }
                }
            }, types_1.SERVER_CONSTANTS.STARTUP_TIMEOUT_MS);
            const onData = (chunk) => {
                if (resolved) {
                    return;
                }
                const text = chunk.toString();
                this.outputChannel.appendLine(text.trimEnd());
                const match = portRegex.exec(text);
                if (match) {
                    resolved = true;
                    clearTimeout(timer);
                    child.stderr?.removeListener("data", onData);
                    resolve(parseInt(match[1], 10));
                }
            };
            child.stderr?.on("data", onData);
            child.on("error", (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    reject(new types_1.McpSpawnError(err.message));
                }
            });
            child.on("exit", (code) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    reject(new types_1.McpSpawnError(`Server exited immediately with code ${code}`));
                }
            });
        });
    }
    /**
     * Write PID file to .code-intel/server.pid
     */
    writePidFile() {
        if (!this._pid) {
            return;
        }
        try {
            const dir = path.join(this.workspaceFolder, ".code-intel");
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(path.join(dir, "server.pid"), String(this._pid), "utf-8");
        }
        catch {
            // Non-critical
        }
    }
    /**
     * Remove PID file.
     */
    removePidFile() {
        try {
            const pidPath = path.join(this.workspaceFolder, ".code-intel", "server.pid");
            if (fs.existsSync(pidPath)) {
                fs.unlinkSync(pidPath);
            }
        }
        catch {
            // Non-critical
        }
    }
    /**
     * Update .kiro/settings/mcp.json with the code-intelligence httpStream entry.
     */
    updateMcpJson() {
        if (!this._port) {
            return;
        }
        try {
            const mcpDir = path.join(this.workspaceFolder, ".kiro", "settings");
            const mcpPath = path.join(mcpDir, "mcp.json");
            let config = {};
            if (fs.existsSync(mcpPath)) {
                config = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
            }
            else {
                if (!fs.existsSync(mcpDir)) {
                    fs.mkdirSync(mcpDir, { recursive: true });
                }
            }
            const servers = config.mcpServers || {};
            const existing = servers["code-intelligence"] || {};
            servers["code-intelligence"] = {
                ...existing,
                type: "httpStream",
                url: `http://127.0.0.1:${this._port}/mcp`,
            };
            config.mcpServers = servers;
            fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), "utf-8");
            this.outputChannel.appendLine(`[MCP] Updated mcp.json → http://127.0.0.1:${this._port}/mcp`);
        }
        catch (err) {
            this.outputChannel.appendLine(`[MCP] Warning: could not update mcp.json: ${err.message}`);
        }
    }
}
exports.McpServerManager = McpServerManager;
/**
 * Generate a cryptographic nonce for CSP script authorization.
 */
function getNonce() {
    const array = crypto.randomBytes(16);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
//# sourceMappingURL=mcp-server-manager-legacy.js.map