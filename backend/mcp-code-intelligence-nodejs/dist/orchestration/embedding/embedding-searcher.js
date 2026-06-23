"use strict";
/**
 * EmbeddingSearcher — adapter connecting find_tools to ONNX embedding search.
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
exports.EmbeddingSearcher = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const tool_index_js_1 = require("./tool-index.js");
const DEFAULT_TIMEOUT_MS = 100;
class EmbeddingSearcher {
    modelManager;
    registry;
    provider = null;
    index = new tool_index_js_1.ToolEmbeddingIndex();
    initialized = false;
    constructor(modelManager, registry) {
        this.modelManager = modelManager;
        this.registry = registry;
    }
    /** True if ONNX model is loaded and ready. */
    get isAvailable() {
        if (!this.initialized)
            this.tryInit();
        return this.provider !== null && this.index.isBuilt;
    }
    /** Search tools by embedding similarity. Returns [toolName, score] or null. */
    search(query, timeoutMs = DEFAULT_TIMEOUT_MS) {
        if (!this.isAvailable)
            return null;
        const start = performance.now();
        try {
            const queryVec = this.provider.embed(query);
            if (!queryVec)
                return null;
            const elapsed = performance.now() - start;
            if (elapsed > timeoutMs) {
                console.error(`[embedding-searcher] Timeout: ${elapsed.toFixed(0)}ms > ${timeoutMs}ms`);
                return null;
            }
            const results = this.index.search(queryVec, 1);
            if (results.length === 0)
                return null;
            return results[0];
        }
        catch (e) {
            console.error(`[embedding-searcher] Search error: ${e.message}`);
            return null;
        }
    }
    /** Rebuild tool embedding index (after model switch or new tools). */
    rebuildIndex() {
        if (!this.provider)
            this.tryInit();
        if (!this.provider)
            return;
        this.index.build(this.registry, (text) => this.provider.embed(text));
    }
    tryInit() {
        this.initialized = true;
        try {
            const provider = this.createProvider();
            if (!provider || !provider.isAvailable())
                return;
            this.provider = provider;
            this.index.build(this.registry, (text) => provider.embed(text));
        }
        catch (e) {
            console.error(`[embedding-searcher] Init failed: ${e.message}`);
        }
    }
    createProvider() {
        try {
            // Try to load ONNX provider from memory module
            const modelPath = this.modelManager.getActiveModelPath();
            let modelFile = path.join(modelPath, 'model.onnx');
            let vocabFile = path.join(modelPath, 'vocab.txt');
            if (!fs.existsSync(modelFile)) {
                const altPath = path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.code-intel', 'models');
                modelFile = path.join(altPath, 'model.onnx');
                vocabFile = path.join(altPath, 'vocab.txt');
            }
            if (!fs.existsSync(modelFile))
                return null;
            // Dynamic import of ONNX provider (optional dependency)
            const { OnnxEmbeddingProvider } = require('../../memory/embedding/onnx-provider.js');
            return new OnnxEmbeddingProvider(modelFile, vocabFile);
        }
        catch {
            console.error('[embedding-searcher] ONNX runtime not available — embedding disabled');
            return null;
        }
    }
}
exports.EmbeddingSearcher = EmbeddingSearcher;
//# sourceMappingURL=embedding-searcher.js.map