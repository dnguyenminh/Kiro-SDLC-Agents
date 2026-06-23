"use strict";
/**
 * ModelRegistry — tracks downloaded models and active selection via registry.json.
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
exports.ModelRegistry = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const model_catalog_js_1 = require("./model-catalog.js");
const REGISTRY_FILE = 'registry.json';
class ModelRegistry {
    dir;
    filePath;
    data = null;
    constructor(modelsDir) {
        this.dir = modelsDir;
        this.filePath = path.join(modelsDir, REGISTRY_FILE);
    }
    get activeModel() {
        this.data = null; // Invalidate cache — external tools may update registry
        return this.loadData().active_model ?? model_catalog_js_1.DEFAULT_MODEL;
    }
    get modelsDir() { return this.dir; }
    /** Check if a model is marked as downloaded. */
    isDownloaded(modelName) {
        const data = this.loadData();
        return modelName in (data.models ?? {});
    }
    /** Get path for a specific model. */
    modelPath(modelName) {
        return path.join(this.dir, modelName);
    }
    /** Mark a model as downloaded in registry. */
    markDownloaded(modelName, sizeBytes) {
        const data = this.loadData();
        if (!data.models)
            data.models = {};
        data.models[modelName] = {
            path: this.modelPath(modelName),
            downloaded_at: nowIso(),
            size_bytes: sizeBytes,
        };
        data.last_updated = nowIso();
        this.save(data);
    }
    /** Set the active model. */
    setActive(modelName) {
        const data = this.loadData();
        data.active_model = modelName;
        data.last_updated = nowIso();
        this.save(data);
        console.error(`[model-registry] Active model set to: ${modelName}`);
    }
    /** Get all downloaded model entries. */
    getDownloadedModels() {
        return this.loadData().models ?? {};
    }
    loadData() {
        if (this.data !== null)
            return this.data;
        if (!fs.existsSync(this.filePath)) {
            this.data = { active_model: model_catalog_js_1.DEFAULT_MODEL, models: {} };
            return this.data;
        }
        try {
            const text = fs.readFileSync(this.filePath, 'utf-8');
            this.data = JSON.parse(text);
        }
        catch (e) {
            console.error(`[model-registry] Load failed: ${e.message}`);
            this.data = { active_model: model_catalog_js_1.DEFAULT_MODEL, models: {} };
        }
        return this.data;
    }
    save(data) {
        this.data = data;
        try {
            if (!fs.existsSync(this.dir))
                fs.mkdirSync(this.dir, { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (e) {
            console.error(`[model-registry] Save failed: ${e.message}`);
        }
    }
}
exports.ModelRegistry = ModelRegistry;
function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
//# sourceMappingURL=model-registry.js.map