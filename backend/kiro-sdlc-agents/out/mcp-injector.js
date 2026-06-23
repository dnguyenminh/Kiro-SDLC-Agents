"use strict";
/**
 * MCP server config injection — handles migration from legacy scripts,
 * downloads MCP servers from GitHub Release, and injects config.
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
exports.migrateLegacyScripts = migrateLegacyScripts;
exports.injectMcpConfig = injectMcpConfig;
exports.hasMcpConfig = hasMcpConfig;
exports.writeBundledMcpConfig = writeBundledMcpConfig;
exports.removeBundledMcpConfig = removeBundledMcpConfig;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const config_1 = require("./config");
/** Migrate legacy scripts folder and report what was cleaned up. */
function migrateLegacyScripts(root) {
    let removed = false;
    const scriptsDir = path.join(root, ".analysis", "code-intelligence", "scripts");
    if (fs.existsSync(scriptsDir)) {
        fs.rmSync(scriptsDir, { recursive: true, force: true });
        removed = true;
    }
    return { removed };
}
/** Show picker for MCP variant and inject config into .kiro/settings/mcp.json. */
async function injectMcpConfig(root) {
    // Step 1: Pick MCP variant
    const variantPicks = config_1.MCP_VARIANTS.map(v => ({
        label: v.label, description: v.description, variant: v
    }));
    const selected = await vscode.window.showQuickPick(variantPicks, {
        placeHolder: "Step 1/2: Choose Code Intelligence MCP server variant"
    });
    if (!selected) {
        return null;
    }
    const variant = selected.variant;
    if (variant.delivery === "download") {
        const ok = await downloadVariant(variant, root);
        if (!ok) {
            return null;
        }
    }
    // Step 2: Ollama semantic search?
    const ollamaEnv = await promptOllamaSetup();
    const resolvedConfig = resolveConfig(variant, ollamaEnv, root);
    writeMcpConfig(root, resolvedConfig);
    writeDefaultOrchestrationConfig(root);
    return variant.id;
}
/** Prompt user for Ollama setup (guided wizard). */
async function promptOllamaSetup() {
    const enableOllama = await vscode.window.showQuickPick([
        { label: "No — FTS5 keyword search only (fast, zero setup)", value: false },
        { label: "Yes — Enable semantic search with Ollama", value: true }
    ], { placeHolder: "Step 2/2: Enable Ollama semantic search?" });
    if (!enableOllama || !enableOllama.value) {
        return {};
    }
    // Step 3: Ollama URL
    const url = await vscode.window.showInputBox({
        prompt: "Ollama server URL",
        value: "http://localhost:11434",
        placeHolder: "http://localhost:11434"
    });
    if (!url) {
        return {};
    }
    // Step 4: Load available models from Ollama
    const model = await pickOllamaModel(url);
    if (!model) {
        return {};
    }
    return { OLLAMA_URL: url, OLLAMA_MODEL: model };
}
/** Fetch available models from Ollama API and let user pick one. */
async function pickOllamaModel(ollamaUrl) {
    try {
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (!response.ok) {
            vscode.window.showErrorMessage(`Cannot reach Ollama at ${ollamaUrl} (HTTP ${response.status})`);
            return null;
        }
        const data = await response.json();
        const models = (data.models || []).map(m => m.name);
        if (models.length === 0) {
            vscode.window.showWarningMessage("No models found. Run: ollama pull nomic-embed-text");
            return "nomic-embed-text";
        }
        // Prefer embedding models, show all
        const picks = models.map(m => ({
            label: m,
            description: m.includes("embed") ? "⭐ embedding model" : ""
        }));
        const selected = await vscode.window.showQuickPick(picks, {
            placeHolder: "Choose embedding model (recommend: nomic-embed-text)"
        });
        return selected?.label || null;
    }
    catch (err) {
        vscode.window.showErrorMessage(`Cannot connect to Ollama: ${err}`);
        // Offer manual input as fallback
        const manual = await vscode.window.showInputBox({
            prompt: "Ollama model name (manual input — server unreachable)",
            value: "nomic-embed-text"
        });
        return manual ?? null;
    }
}
/** Check if MCP code-intelligence config exists in workspace. */
function hasMcpConfig(workspaceRoot) {
    const mcpConfigPath = path.join(workspaceRoot, ".kiro", "settings", "mcp.json");
    if (!fs.existsSync(mcpConfigPath)) {
        return false;
    }
    try {
        const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
        return !!config?.mcpServers?.["code-intelligence"];
    }
    catch {
        return false;
    }
}
/**
 * Write HTTP Streamable MCP config after bundled server starts.
 * Called by McpServerManager once the dynamic port is known.
 */
function writeBundledMcpConfig(workspaceRoot, port) {
    const serverConfig = {
        url: `http://127.0.0.1:${port}/mcp`,
        transportType: "httpStream",
        disabled: false,
    };
    writeMcpConfig(workspaceRoot, serverConfig);
}
/**
 * Remove the bundled code-intelligence entry from .kiro/settings/mcp.json.
 * Called when server is intentionally stopped.
 */
function removeBundledMcpConfig(workspaceRoot) {
    const mcpConfigPath = path.join(workspaceRoot, ".kiro", "settings", "mcp.json");
    if (!fs.existsSync(mcpConfigPath)) {
        return;
    }
    try {
        const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
        if (config?.mcpServers?.["code-intelligence"]) {
            config.mcpServers["code-intelligence"].disabled = true;
            fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
        }
    }
    catch { /* non-fatal */ }
}
/** Resolve ${mcpServersDir} placeholder in config args. */
function resolveConfig(variant, ollamaEnv, root) {
    const serversDir = getMcpServersDir(root);
    const config = { ...variant.config };
    const args = (variant.config.args || []).map((arg) => arg.replace("${mcpServersDir}", serversDir)
        .replace("${workspaceFolder}", root));
    config.args = args;
    if (variant.config.cwd) {
        config.cwd = variant.config.cwd
            .replace("${mcpServersDir}", serversDir)
            .replace("${workspaceFolder}", root);
    }
    // Build env: required vars + Ollama vars (if enabled)
    const env = {
        CODE_INTEL_WORKSPACE: root,
        CODE_INTEL_VIEWER_PORT: "3200",
        FORCE_RESTART: "15",
        ...ollamaEnv
    };
    config.env = env;
    return config;
}
/** Create default .code-intel/orchestration.json if not exists. */
function writeDefaultOrchestrationConfig(root) {
    const orchPath = path.join(root, ".code-intel", "orchestration.json");
    if (fs.existsSync(orchPath)) {
        return;
    }
    const defaultConfig = {
        mcpServers: {},
        settings: {
            autoLog: { enabled: true, excludeTools: ["mem_audit", "mem_status"], maxArgLength: 200 },
            healthCheckIntervalMs: 30000,
            maxRestartRetries: 3,
            similarityThreshold: 0.7,
            maxRecursionDepth: 3,
            discoveryTimeoutMs: 10000,
            kbSearchTimeoutMs: 2000
        }
    };
    fs.mkdirSync(path.dirname(orchPath), { recursive: true });
    fs.writeFileSync(orchPath, JSON.stringify(defaultConfig, null, 2));
}
/** Write MCP config to .kiro/settings/mcp.json (merge, not overwrite). */
function writeMcpConfig(root, serverConfig) {
    const mcpConfigPath = path.join(root, ".kiro", "settings", "mcp.json");
    let config = { mcpServers: {} };
    if (fs.existsSync(mcpConfigPath)) {
        try {
            config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
            config.mcpServers = config.mcpServers || {};
        }
        catch {
            config = { mcpServers: {} };
        }
    }
    // Merge with existing entry to preserve autoApprove, disabled, and other user settings
    const servers = config.mcpServers;
    const existing = servers["code-intelligence"] || {};
    servers["code-intelligence"] = { ...existing, ...serverConfig };
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
}
/** Download MCP server asset from GitHub Release. */
async function downloadVariant(variant, root) {
    if (!variant.downloadAsset) {
        return false;
    }
    const destDir = getMcpServersDir(root);
    const assetPath = path.join(destDir, variant.downloadAsset);
    if (fs.existsSync(assetPath.replace(".zip", "").replace(".jar", ".jar"))) {
        const reuse = await vscode.window.showInformationMessage(`MCP server "${variant.id}" already downloaded. Re-download?`, "Use Existing", "Re-download");
        if (reuse === "Use Existing") {
            return true;
        }
    }
    const url = `https://github.com/${config_1.GITHUB_RELEASE_REPO}/releases/latest/download/${variant.downloadAsset}`;
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Downloading ${variant.id} MCP server...` }, async () => {
        try {
            fs.mkdirSync(destDir, { recursive: true });
            await downloadFile(url, assetPath);
            if (assetPath.endsWith(".zip")) {
                await extractZip(assetPath, path.join(destDir, variant.id));
                fs.unlinkSync(assetPath);
            }
            vscode.window.showInformationMessage(`✅ Downloaded ${variant.id} MCP server`);
            return true;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to download: ${err}`);
            return false;
        }
    });
}
/** Get workspace-local MCP servers directory ({workspace}/.code-intel/servers/). */
function getMcpServersDir(root) {
    if (root)
        return path.join(root, config_1.MCP_SERVERS_DIR);
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0)
        return path.join(folders[0].uri.fsPath, config_1.MCP_SERVERS_DIR);
    return path.join(os.homedir(), config_1.MCP_SERVERS_DIR);
}
/** Download a file from URL to local path using fetch. */
async function downloadFile(url, dest) {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);
}
/** Extract a zip file to a directory using Node.js child_process. */
async function extractZip(zipPath, destDir) {
    const { execSync } = await Promise.resolve().then(() => __importStar(require("child_process")));
    fs.mkdirSync(destDir, { recursive: true });
    // Use PowerShell Expand-Archive on Windows, unzip on Unix
    if (process.platform === "win32") {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: "ignore" });
    }
    else {
        execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "ignore" });
    }
}
//# sourceMappingURL=mcp-injector.js.map