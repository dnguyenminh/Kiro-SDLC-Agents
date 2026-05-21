/**
 * Model Downloader — download embedding models directly from HuggingFace.
 * Self-contained: no MCP server dependency. Manages ~/.code-intel/models/.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

interface ModelInfo {
    name: string;
    displayName: string;
    sizeMb: number;
    languages: string[];
    baseUrl: string;
    files: Record<string, string>;
}

const MODELS: ModelInfo[] = [
    {
        name: "all-MiniLM-L6-v2",
        displayName: "English (Small, Fast)",
        sizeMb: 90,
        languages: ["en"],
        baseUrl: "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main",
        files: { model: "onnx/model.onnx", vocab: "vocab.txt" },
    },
    {
        name: "paraphrase-multilingual-MiniLM-L12-v2",
        displayName: "Multilingual (50+ languages)",
        sizeMb: 470,
        languages: ["en", "vi", "zh", "ja", "ko", "fr", "de", "es", "ar", "ru"],
        baseUrl: "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main",
        files: { model: "onnx/model.onnx", vocab: "sentencepiece.bpe.model" },
    },
];

const MODELS_DIR = path.join(process.env.HOME ?? process.env.USERPROFILE ?? "~", ".code-intel", "models");
const REGISTRY_PATH = path.join(MODELS_DIR, "registry.json");

/**
 * Command handler: show model picker and download/switch.
 */
export async function handleDownloadModel(): Promise<void> {
    const registry = loadRegistry();
    const pick = await showModelPicker(registry);
    if (!pick) { return; }

    if (pick.action === "download") {
        await downloadModel(pick.model, registry);
    } else if (pick.action === "switch") {
        switchModel(pick.model.name, registry);
        vscode.window.showInformationMessage(`✅ Active model switched to: ${pick.model.displayName}`);
    }
}


interface Registry {
    active_model: string;
    models: Record<string, { downloaded_at: string; size_bytes: number }>;
}

interface PickResult {
    action: "download" | "switch";
    model: ModelInfo;
}

function loadRegistry(): Registry {
    try {
        if (fs.existsSync(REGISTRY_PATH)) {
            return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
        }
    } catch { /* ignore */ }
    return { active_model: "all-MiniLM-L6-v2", models: {} };
}

function saveRegistry(registry: Registry): void {
    if (!fs.existsSync(MODELS_DIR)) { fs.mkdirSync(MODELS_DIR, { recursive: true }); }
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

function isDownloaded(model: ModelInfo): boolean {
    const modelDir = path.join(MODELS_DIR, model.name);
    const onnxFile = path.join(modelDir, "model.onnx");
    return fs.existsSync(onnxFile);
}

function switchModel(modelName: string, registry: Registry): void {
    registry.active_model = modelName;
    saveRegistry(registry);
}

async function showModelPicker(registry: Registry): Promise<PickResult | undefined> {
    const items = MODELS.map(m => {
        const downloaded = isDownloaded(m);
        const active = m.name === registry.active_model && downloaded;
        const icon = active ? "$(check)" : downloaded ? "$(cloud-download)" : "$(cloud)";
        const status = active ? "Active" : downloaded ? "Downloaded" : "Not downloaded";
        return {
            label: `${icon}  ${m.displayName}`,
            description: `${m.sizeMb}MB — ${m.languages.join(", ")} — ${status}`,
            detail: m.name,
            model: m,
            downloaded,
            active,
        };
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an embedding model to download or activate",
    });
    if (!selected) { return undefined; }

    if (!selected.downloaded) {
        return { action: "download", model: selected.model };
    }
    if (!selected.active) {
        const action = await vscode.window.showInformationMessage(
            `Model "${selected.model.displayName}" is already downloaded. Activate it?`,
            "Activate", "Cancel"
        );
        if (action === "Activate") {
            return { action: "switch", model: selected.model };
        }
    } else {
        vscode.window.showInformationMessage(`Model "${selected.model.displayName}" is already active.`);
    }
    return undefined;
}

async function downloadModel(model: ModelInfo, registry: Registry): Promise<void> {
    const modelDir = path.join(MODELS_DIR, model.name);
    if (!fs.existsSync(modelDir)) { fs.mkdirSync(modelDir, { recursive: true }); }

    const fileEntries = Object.entries(model.files);
    let completed = 0;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Downloading: ${model.displayName}`, cancellable: true },
        async (progress, token) => {
            for (const [_key, relPath] of fileEntries) {
                if (token.isCancellationRequested) { return; }
                const url = `${model.baseUrl}/${relPath}`;
                const target = path.join(modelDir, path.basename(relPath));

                if (fs.existsSync(target)) {
                    completed++;
                    progress.report({ increment: (100 / fileEntries.length), message: `${path.basename(relPath)} (cached)` });
                    continue;
                }

                progress.report({ message: `${path.basename(relPath)} (${completed + 1}/${fileEntries.length})...` });
                try {
                    await downloadFile(url, target);
                    completed++;
                    progress.report({ increment: (100 / fileEntries.length) });
                } catch (err: any) {
                    vscode.window.showErrorMessage(`❌ Download failed: ${err.message}`);
                    return;
                }
            }

            // Update registry
            const size = fs.readdirSync(modelDir)
                .filter(f => fs.statSync(path.join(modelDir, f)).isFile())
                .reduce((sum, f) => sum + fs.statSync(path.join(modelDir, f)).size, 0);
            registry.models[model.name] = { downloaded_at: new Date().toISOString(), size_bytes: size };
            saveRegistry(registry);

            const activate = await vscode.window.showInformationMessage(
                `✅ Model "${model.displayName}" downloaded (${Math.round(size / 1024 / 1024)}MB). Activate now?`,
                "Activate", "Later"
            );
            if (activate === "Activate") {
                switchModel(model.name, registry);
                vscode.window.showInformationMessage(`✅ Active model: ${model.displayName}`);
            }
        }
    );
}

function downloadFile(url: string, target: string, maxRedirects: number = 10): Promise<void> {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) { reject(new Error("Too many redirects")); return; }

        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === "https:" ? https : require("http");

        client.get(url, (res: any) => {
            const status = res.statusCode ?? 0;

            // Handle all redirect types (301, 302, 303, 307, 308)
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume(); // Drain response
                let redirectUrl = res.headers.location;
                // Resolve relative URLs
                if (redirectUrl.startsWith("/")) {
                    redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
                }
                downloadFile(redirectUrl, target, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }

            if (status !== 200) {
                res.resume();
                reject(new Error(`HTTP ${status} for ${url}`));
                return;
            }

            const file = fs.createWriteStream(target);
            res.pipe(file);
            file.on("finish", () => { file.close(); resolve(); });
            file.on("error", (err: Error) => {
                file.close();
                if (fs.existsSync(target)) { fs.unlinkSync(target); }
                reject(err);
            });
        }).on("error", (err: Error) => {
            if (fs.existsSync(target)) { fs.unlinkSync(target); }
            reject(err);
        });
    });
}
