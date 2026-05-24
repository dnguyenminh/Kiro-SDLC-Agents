"use strict";
/**
 * ModelManager — MCP tool for model lifecycle (list, download, status, switch).
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
exports.ModelManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const model_catalog_js_1 = require("./model-catalog.js");
const model_registry_js_1 = require("./model-registry.js");
const GLOBAL_MODELS_DIR = path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.code-intel', 'models');
class ModelManager {
    registry;
    downloading = new Set();
    constructor(modelsDir) {
        this.registry = new model_registry_js_1.ModelRegistry(modelsDir ?? GLOBAL_MODELS_DIR);
    }
    /** Handle action: list, download, status, switch. */
    execute(args) {
        const action = (args.action ?? '').toLowerCase();
        const handlers = {
            list: (a) => this.handleList(a),
            download: (a) => this.handleDownload(a),
            status: (a) => this.handleStatus(a),
            switch: (a) => this.handleSwitch(a),
        };
        const handler = handlers[action];
        if (!handler)
            return JSON.stringify({ error: 'INVALID_ACTION', message: 'Use: list, download, status, switch' });
        return handler(args);
    }
    getActiveModel() { return this.registry.activeModel; }
    getActiveModelPath() { return this.registry.modelPath(this.registry.activeModel); }
    /** Background download of default model on first need. */
    autoDownloadIfNeeded() {
        const modelName = model_catalog_js_1.DEFAULT_MODEL;
        const modelFile = path.join(this.registry.modelPath(modelName), 'model.onnx');
        if (fs.existsSync(modelFile))
            return;
        if (this.downloading.has(modelName))
            return;
        this.backgroundDownload(modelName);
    }
    handleList(_args) {
        const models = (0, model_catalog_js_1.listModels)().map((m) => ({
            ...m, downloaded: this.registry.isDownloaded(m.name), active: m.name === this.registry.activeModel,
        }));
        return JSON.stringify({ models });
    }
    handleDownload(args) {
        const modelName = args.model_name ?? '';
        const info = (0, model_catalog_js_1.getModelInfo)(modelName);
        if (!info)
            return JSON.stringify({ error: 'MODEL_NOT_FOUND', message: `Unknown model: ${modelName}` });
        return this.doDownload(modelName, info);
    }
    handleStatus(_args) {
        const active = this.registry.activeModel;
        const info = (0, model_catalog_js_1.getModelInfo)(active);
        return JSON.stringify({
            active_model: active, model_path: this.registry.modelPath(active),
            dimensions: info?.dimensions ?? 384, languages: info?.languages ?? [],
        });
    }
    handleSwitch(args) {
        const modelName = args.model_name ?? '';
        if (!(0, model_catalog_js_1.getModelInfo)(modelName))
            return JSON.stringify({ error: 'MODEL_NOT_FOUND', message: `Unknown: ${modelName}` });
        if (!this.registry.isDownloaded(modelName))
            return JSON.stringify({ error: 'MODEL_NOT_DOWNLOADED', message: 'Download first' });
        this.registry.setActive(modelName);
        return JSON.stringify({ success: true, active_model: modelName });
    }
    doDownload(modelName, info) {
        const modelDir = this.registry.modelPath(modelName);
        if (!fs.existsSync(modelDir))
            fs.mkdirSync(modelDir, { recursive: true });
        // Synchronous download not practical in Node — mark as pending
        console.error(`[model-manager] Download requested: ${modelName} (use autoDownloadIfNeeded for background)`);
        this.backgroundDownload(modelName);
        return JSON.stringify({ success: true, model: modelName, path: modelDir, status: 'downloading' });
    }
    backgroundDownload(modelName) {
        if (this.downloading.has(modelName))
            return;
        this.downloading.add(modelName);
        const info = (0, model_catalog_js_1.getModelInfo)(modelName);
        if (!info) {
            this.downloading.delete(modelName);
            return;
        }
        console.error(`[model-manager] Auto-downloading: ${modelName}`);
        const modelDir = this.registry.modelPath(modelName);
        if (!fs.existsSync(modelDir))
            fs.mkdirSync(modelDir, { recursive: true });
        this.downloadFiles(modelName, info, modelDir).finally(() => this.downloading.delete(modelName));
    }
    async downloadFiles(modelName, info, modelDir) {
        for (const [_key, relPath] of Object.entries(info.files)) {
            const url = `${info.baseUrl}/${relPath}`;
            const target = path.join(modelDir, path.basename(relPath));
            if (fs.existsSync(target))
                continue;
            try {
                await this.downloadFile(url, target);
            }
            catch (e) {
                console.error(`[model-manager] Download failed: ${e.message}`);
                return;
            }
        }
        const size = fs.readdirSync(modelDir).reduce((sum, f) => {
            const stat = fs.statSync(path.join(modelDir, f));
            return sum + (stat.isFile() ? stat.size : 0);
        }, 0);
        this.registry.markDownloaded(modelName, size);
        console.error(`[model-manager] Download complete: ${modelName}`);
    }
    downloadFile(url, target) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            client.get(url, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    this.downloadFile(res.headers.location, target).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                const ws = fs.createWriteStream(target);
                res.pipe(ws);
                ws.on('finish', () => { ws.close(); resolve(); });
                ws.on('error', reject);
            }).on('error', reject);
        });
    }
}
exports.ModelManager = ModelManager;
//# sourceMappingURL=model-manager.js.map