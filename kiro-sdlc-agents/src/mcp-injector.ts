/**
 * MCP server config injection — handles migration from legacy scripts,
 * downloads MCP servers from GitHub Release, and injects config.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MCP_VARIANTS, MCP_SERVERS_DIR, GITHUB_RELEASE_REPO, McpVariant } from "./config";

/** Migrate legacy scripts folder and report what was cleaned up. */
export function migrateLegacyScripts(root: string): { removed: boolean } {
    let removed = false;
    const scriptsDir = path.join(root, ".analysis", "code-intelligence", "scripts");
    if (fs.existsSync(scriptsDir)) {
        fs.rmSync(scriptsDir, { recursive: true, force: true });
        removed = true;
    }
    return { removed };
}

/** Show picker for MCP variant and inject config into .kiro/settings/mcp.json. */
export async function injectMcpConfig(root: string): Promise<string | null> {
    // Step 1: Pick MCP variant
    const variantPicks = MCP_VARIANTS.map(v => ({
        label: v.label, description: v.description, variant: v
    }));
    const selected = await vscode.window.showQuickPick(variantPicks, {
        placeHolder: "Step 1/2: Choose Code Intelligence MCP server variant"
    });
    if (!selected) { return null; }

    const variant = selected.variant;

    if (variant.delivery === "download") {
        const ok = await downloadVariant(variant, root);
        if (!ok) { return null; }
    }

    // Step 2: Ollama semantic search?
    const ollamaEnv = await promptOllamaSetup();

    const resolvedConfig = resolveConfig(variant, ollamaEnv, root);
    writeMcpConfig(root, resolvedConfig);
    return variant.id;
}

/** Prompt user for Ollama setup (guided wizard). */
async function promptOllamaSetup(): Promise<Record<string, string>> {
    const enableOllama = await vscode.window.showQuickPick(
        [
            { label: "No — FTS5 keyword search only (fast, zero setup)", value: false },
            { label: "Yes — Enable semantic search with Ollama", value: true }
        ],
        { placeHolder: "Step 2/2: Enable Ollama semantic search?" }
    );

    if (!enableOllama || !enableOllama.value) { return {}; }

    // Step 3: Ollama URL
    const url = await vscode.window.showInputBox({
        prompt: "Ollama server URL",
        value: "http://localhost:11434",
        placeHolder: "http://localhost:11434"
    });
    if (!url) { return {}; }

    // Step 4: Load available models from Ollama
    const model = await pickOllamaModel(url);
    if (!model) { return {}; }

    return { OLLAMA_URL: url, OLLAMA_MODEL: model };
}

/** Fetch available models from Ollama API and let user pick one. */
async function pickOllamaModel(ollamaUrl: string): Promise<string | null> {
    try {
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (!response.ok) {
            vscode.window.showErrorMessage(`Cannot reach Ollama at ${ollamaUrl} (HTTP ${response.status})`);
            return null;
        }
        const data = await response.json() as { models?: { name: string }[] };
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
    } catch (err) {
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
export function hasMcpConfig(workspaceRoot: string): boolean {
    const mcpConfigPath = path.join(workspaceRoot, ".kiro", "settings", "mcp.json");
    if (!fs.existsSync(mcpConfigPath)) { return false; }
    try {
        const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
        return !!config?.mcpServers?.["code-intelligence"];
    } catch {
        return false;
    }
}

/** Resolve ${mcpServersDir} placeholder in config args. */
function resolveConfig(variant: McpVariant, ollamaEnv: Record<string, string>, root: string): Record<string, unknown> {
    const serversDir = getMcpServersDir(root);
    const config: Record<string, unknown> = { ...variant.config };
    const args = (variant.config.args || []).map((arg: string) =>
        arg.replace("${mcpServersDir}", serversDir)
           .replace("${workspaceFolder}", root)
    );
    config.args = args;
    if (variant.config.cwd) {
        config.cwd = variant.config.cwd.replace("${mcpServersDir}", serversDir);
    }

    // Inject Ollama env vars if user enabled it
    if (Object.keys(ollamaEnv).length > 0) {
        config.env = ollamaEnv;
    }

    return config;
}

/** Write MCP config to .kiro/settings/mcp.json (merge, not overwrite). */
function writeMcpConfig(root: string, serverConfig: Record<string, unknown>): void {
    const mcpConfigPath = path.join(root, ".kiro", "settings", "mcp.json");
    let config: Record<string, unknown> = { mcpServers: {} };

    if (fs.existsSync(mcpConfigPath)) {
        try {
            config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
            config.mcpServers = config.mcpServers || {};
        } catch {
            config = { mcpServers: {} };
        }
    }

    (config.mcpServers as Record<string, unknown>)["code-intelligence"] = serverConfig;
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
}

/** Download MCP server asset from GitHub Release. */
async function downloadVariant(variant: McpVariant, root: string): Promise<boolean> {
    if (!variant.downloadAsset) { return false; }

    const destDir = getMcpServersDir(root);
    const assetPath = path.join(destDir, variant.downloadAsset);

    if (fs.existsSync(assetPath.replace(".zip", "").replace(".jar", ".jar"))) {
        const reuse = await vscode.window.showInformationMessage(
            `MCP server "${variant.id}" already downloaded. Re-download?`,
            "Use Existing", "Re-download"
        );
        if (reuse === "Use Existing") { return true; }
    }

    const url = `https://github.com/${GITHUB_RELEASE_REPO}/releases/latest/download/${variant.downloadAsset}`;

    return vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Downloading ${variant.id} MCP server...` },
        async () => {
            try {
                fs.mkdirSync(destDir, { recursive: true });
                await downloadFile(url, assetPath);

                if (assetPath.endsWith(".zip")) {
                    await extractZip(assetPath, path.join(destDir, variant.id));
                    fs.unlinkSync(assetPath);
                }

                vscode.window.showInformationMessage(`✅ Downloaded ${variant.id} MCP server`);
                return true;
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to download: ${err}`);
                return false;
            }
        }
    );
}

/** Get workspace-local MCP servers directory ({workspace}/.code-intel/servers/). */
function getMcpServersDir(root?: string): string {
    if (root) return path.join(root, MCP_SERVERS_DIR);
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) return path.join(folders[0].uri.fsPath, MCP_SERVERS_DIR);
    return path.join(os.homedir(), MCP_SERVERS_DIR);
}

/** Download a file from URL to local path using fetch. */
async function downloadFile(url: string, dest: string): Promise<void> {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) { throw new Error(`HTTP ${response.status}: ${url}`); }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);
}

/** Extract a zip file to a directory using Node.js child_process. */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
    const { execSync } = await import("child_process");
    fs.mkdirSync(destDir, { recursive: true });
    // Use PowerShell Expand-Archive on Windows, unzip on Unix
    if (process.platform === "win32") {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: "ignore" });
    } else {
        execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "ignore" });
    }
}
