/**
 * Model Downloader — download embedding models via MCP server HTTP API.
 * Provides QuickPick UI for model selection and progress reporting.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface ModelInfo {
    name: string;
    display_name: string;
    size_mb: number;
    languages: string[];
    downloaded: boolean;
    active: boolean;
}

/**
 * Command handler: show model picker and download selected model.
 */
export async function handleDownloadModel(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) { return; }

    const port = resolveViewerPort(root);
    const models = await fetchModelList(port);

    if (!models) {
        vscode.window.showErrorMessage(
            "❌ Cannot reach MCP server. Ensure it is running."
        );
        return;
    }

    const pick = await showModelPicker(models);
    if (!pick) { return; }

    if (pick.action === "download") {
        await downloadModel(port, pick.modelName);
    } else if (pick.action === "switch") {
        await switchModel(port, pick.modelName);
    }
}

async function fetchModelList(port: number): Promise<ModelInfo[] | null> {
    try {
        const data = await httpGet(`http://localhost:${port}/api/models/list`);
        const parsed = JSON.parse(data);
        return parsed.models || [];
    } catch {
        return null;
    }
}

interface PickResult {
    action: "download" | "switch";
    modelName: string;
}

async function showModelPicker(models: ModelInfo[]): Promise<PickResult | undefined> {
    const items = models.map(m => {
        const status = m.active ? "$(check) Active" :
            m.downloaded ? "$(cloud-download) Downloaded" : "$(cloud) Not downloaded";
        const langs = m.languages.join(", ");
        return {
            label: `${status}  ${m.display_name}`,
            description: `${m.size_mb}MB — ${langs}`,
            detail: m.name,
            model: m,
        };
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an embedding model to download or activate",
    });
    if (!selected) { return undefined; }

    const m = selected.model;
    if (!m.downloaded) {
        return { action: "download", modelName: m.name };
    }
    if (!m.active) {
        const action = await vscode.window.showInformationMessage(
            `Model "${m.display_name}" is already downloaded. Activate it?`,
            "Activate", "Cancel"
        );
        if (action === "Activate") {
            return { action: "switch", modelName: m.name };
        }
    } else {
        vscode.window.showInformationMessage(`Model "${m.display_name}" is already active.`);
    }
    return undefined;
}

async function downloadModel(port: number, modelName: string): Promise<void> {
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Downloading model: ${modelName}...`, cancellable: false },
        async () => {
            try {
                const result = await httpPost(
                    `http://localhost:${port}/api/models/download`,
                    { model_name: modelName }
                );
                const parsed = JSON.parse(result);
                if (parsed.success) {
                    const activate = await vscode.window.showInformationMessage(
                        `✅ Model "${modelName}" downloaded. Activate now?`,
                        "Activate", "Later"
                    );
                    if (activate === "Activate") {
                        await switchModel(port, modelName);
                    }
                } else {
                    vscode.window.showErrorMessage(`❌ Download failed: ${parsed.message || parsed.error}`);
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`❌ Download failed: ${err.message}`);
            }
        }
    );
}

async function switchModel(port: number, modelName: string): Promise<void> {
    try {
        const result = await httpPost(
            `http://localhost:${port}/api/models/switch`,
            { model_name: modelName }
        );
        const parsed = JSON.parse(result);
        if (parsed.success) {
            vscode.window.showInformationMessage(`✅ Active model switched to: ${modelName}`);
        } else {
            vscode.window.showErrorMessage(`❌ Switch failed: ${parsed.message || parsed.error}`);
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`❌ Switch failed: ${err.message}`);
    }
}

function resolveViewerPort(root: string): number {
    try {
        const mcpPath = path.join(root, ".kiro", "settings", "mcp.json");
        if (fs.existsSync(mcpPath)) {
            const raw = fs.readFileSync(mcpPath, "utf-8");
            const config = JSON.parse(raw);
            const servers = config.mcpServers || {};
            for (const server of Object.values(servers) as any[]) {
                const env = server.env || {};
                if (env.CODE_INTEL_VIEWER_PORT) {
                    return parseInt(env.CODE_INTEL_VIEWER_PORT, 10);
                }
            }
        }
    } catch { /* ignore */ }
    return 3200;
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return undefined;
    }
    return folders[0].uri.fsPath;
}

function httpGet(url: string): Promise<string> {
    const http = require("http");
    return new Promise((resolve, reject) => {
        http.get(url, (res: any) => {
            let data = "";
            res.on("data", (chunk: string) => { data += chunk; });
            res.on("end", () => resolve(data));
        }).on("error", reject);
    });
}

function httpPost(url: string, body: object): Promise<string> {
    const http = require("http");
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = http.request({
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
            },
        }, (res: any) => {
            let data = "";
            res.on("data", (chunk: string) => { data += chunk; });
            res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}
