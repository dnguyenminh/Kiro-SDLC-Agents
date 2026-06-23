"use strict";
/**
 * Model Downloader — download embedding models directly from HuggingFace.
 * Self-contained: no MCP server dependency. Manages ~/.code-intel/models/.
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
exports.handleDownloadModel = handleDownloadModel;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const MODELS = [
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
async function handleDownloadModel() {
    const registry = loadRegistry();
    const pick = await showModelPicker(registry);
    if (!pick) {
        return;
    }
    if (pick.action === "download") {
        await downloadModel(pick.model, registry);
    }
    else if (pick.action === "switch") {
        switchModel(pick.model.name, registry);
        vscode.window.showInformationMessage(`✅ Active model switched to: ${pick.model.displayName}`);
    }
}
function loadRegistry() {
    try {
        if (fs.existsSync(REGISTRY_PATH)) {
            return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
        }
    }
    catch { /* ignore */ }
    return { active_model: "all-MiniLM-L6-v2", models: {} };
}
function saveRegistry(registry) {
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
    }
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}
function isDownloaded(model) {
    const modelDir = path.join(MODELS_DIR, model.name);
    // Check ALL required files exist (not just model.onnx)
    return Object.values(model.files).every(relPath => {
        const target = path.join(modelDir, path.basename(relPath));
        return fs.existsSync(target) && fs.statSync(target).size > 0;
    });
}
function switchModel(modelName, registry) {
    registry.active_model = modelName;
    saveRegistry(registry);
}
async function showModelPicker(registry) {
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
    if (!selected) {
        return undefined;
    }
    if (!selected.downloaded) {
        return { action: "download", model: selected.model };
    }
    if (!selected.active) {
        const action = await vscode.window.showInformationMessage(`Model "${selected.model.displayName}" is already downloaded. Activate it?`, "Activate", "Cancel");
        if (action === "Activate") {
            return { action: "switch", model: selected.model };
        }
    }
    else {
        vscode.window.showInformationMessage(`Model "${selected.model.displayName}" is already active.`);
    }
    return undefined;
}
async function downloadModel(model, registry) {
    const modelDir = path.join(MODELS_DIR, model.name);
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
    }
    const fileEntries = Object.entries(model.files);
    let completed = 0;
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Downloading: ${model.displayName}`, cancellable: true }, async (progress, token) => {
        for (const [_key, relPath] of fileEntries) {
            if (token.isCancellationRequested) {
                return;
            }
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
            }
            catch (err) {
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
        const activate = await vscode.window.showInformationMessage(`✅ Model "${model.displayName}" downloaded (${Math.round(size / 1024 / 1024)}MB). Activate now?`, "Activate", "Later");
        if (activate === "Activate") {
            switchModel(model.name, registry);
            vscode.window.showInformationMessage(`✅ Active model: ${model.displayName}`);
        }
    });
}
function downloadFile(url, target, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error("Too many redirects"));
            return;
        }
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === "https:" ? https : require("http");
        client.get(url, (res) => {
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
            file.on("error", (err) => {
                file.close();
                if (fs.existsSync(target)) {
                    fs.unlinkSync(target);
                }
                reject(err);
            });
        }).on("error", (err) => {
            if (fs.existsSync(target)) {
                fs.unlinkSync(target);
            }
            reject(err);
        });
    });
}
//# sourceMappingURL=model-downloader.js.map