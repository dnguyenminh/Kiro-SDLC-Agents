"use strict";
/**
 * ConfigWatcher — Monitors .kiro/settings/mcp.json for changes to code-intelligence server config.
 * Debounces rapid edits (500ms) and only triggers restart when config actually changes.
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
exports.ConfigWatcher = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ConfigWatcher {
    workspaceFolder;
    mcpManager;
    watcher;
    debounceTimer;
    lastConfigHash = "";
    suppressUntil = 0;
    outputChannel;
    static DEBOUNCE_MS = 500;
    static SUPPRESS_MS = 2000;
    constructor(workspaceFolder, mcpManager, outputChannel) {
        this.workspaceFolder = workspaceFolder;
        this.mcpManager = mcpManager;
        this.outputChannel = outputChannel;
        this.lastConfigHash = this.computeConfigHash();
        this.startWatching();
    }
    /**
     * Call this BEFORE writing to mcp.json to suppress self-triggered events.
     */
    suppressNextChange() {
        this.suppressUntil = Date.now() + ConfigWatcher.SUPPRESS_MS;
    }
    get mcpConfigPath() {
        return path.join(this.workspaceFolder, ".kiro", "settings", "mcp.json");
    }
    startWatching() {
        const pattern = new vscode.RelativePattern(this.workspaceFolder, ".kiro/settings/mcp.json");
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidChange(() => this.onConfigFileChanged());
        this.watcher.onDidCreate(() => this.onConfigFileChanged());
        this.watcher.onDidDelete(() => this.onConfigFileDeleted());
        this.outputChannel.appendLine("[ConfigWatcher] Watching .kiro/settings/mcp.json");
    }
    onConfigFileChanged() {
        if (Date.now() < this.suppressUntil) {
            return; // Ignore self-triggered change
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.handleConfigChange();
        }, ConfigWatcher.DEBOUNCE_MS);
    }
    onConfigFileDeleted() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.handleConfigDeleted();
        }, ConfigWatcher.DEBOUNCE_MS);
    }
    handleConfigChange() {
        const newHash = this.computeConfigHash();
        if (newHash === this.lastConfigHash) {
            this.outputChannel.appendLine("[ConfigWatcher] Config unchanged (hash match), skipping.");
            return;
        }
        this.lastConfigHash = newHash;
        const config = this.readCodeIntelConfig();
        if (!config) {
            // code-intelligence entry removed or invalid
            this.outputChannel.appendLine("[ConfigWatcher] code-intelligence config removed or invalid. Stopping server.");
            this.mcpManager.disconnect().catch((err) => {
                this.outputChannel.appendLine(`[ConfigWatcher] Disconnect failed: ${err.message}`);
            });
            return;
        }
        // If server is disabled, do NOT restart — just ensure it's stopped
        if (config.disabled === true) {
            this.outputChannel.appendLine("[ConfigWatcher] code-intelligence is disabled. Ensuring server is stopped.");
            this.mcpManager.disconnect().catch((err) => {
                this.outputChannel.appendLine(`[ConfigWatcher] Disconnect failed: ${err.message}`);
            });
            return;
        }
        // Config changed — restart server with new config
        this.outputChannel.appendLine("[ConfigWatcher] code-intelligence config changed. Restarting server...");
        this.mcpManager.reconnect().catch((err) => {
            this.outputChannel.appendLine(`[ConfigWatcher] Reconnect failed: ${err.message}`);
        });
    }
    handleConfigDeleted() {
        this.outputChannel.appendLine("[ConfigWatcher] mcp.json deleted. Stopping server.");
        this.lastConfigHash = "";
        this.mcpManager.disconnect().catch((err) => {
            this.outputChannel.appendLine(`[ConfigWatcher] Disconnect failed: ${err.message}`);
        });
    }
    /**
     * Read the code-intelligence server config from mcp.json.
     * Returns null if file missing, invalid JSON, or code-intelligence entry absent.
     */
    readCodeIntelConfig() {
        try {
            if (!fs.existsSync(this.mcpConfigPath)) {
                return null;
            }
            const raw = fs.readFileSync(this.mcpConfigPath, "utf-8");
            const parsed = JSON.parse(raw);
            const serverConfig = parsed?.mcpServers?.["code-intelligence"];
            if (!serverConfig || typeof serverConfig !== "object") {
                return null;
            }
            return serverConfig;
        }
        catch {
            return null;
        }
    }
    /**
     * Compute a simple hash of the code-intelligence config section only.
     * Used to detect actual changes vs. unrelated edits to other servers.
     */
    computeConfigHash() {
        const config = this.readCodeIntelConfig();
        if (!config) {
            return "";
        }
        return JSON.stringify(config);
    }
    dispose() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.watcher?.dispose();
    }
}
exports.ConfigWatcher = ConfigWatcher;
//# sourceMappingURL=config-watcher.js.map