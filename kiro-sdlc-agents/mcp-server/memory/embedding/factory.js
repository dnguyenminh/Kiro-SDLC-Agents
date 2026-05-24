"use strict";
/**
 * EmbeddingFactory — creates EmbeddingService with priority: Ollama → ONNX → null.
 * Matches Python/Kotlin behavior for provider selection.
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
exports.EmbeddingFactory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const onnx_provider_js_1 = require("./onnx-provider.js");
const ollama_provider_js_1 = require("./ollama-provider.js");
const service_js_1 = require("./service.js");
class EmbeddingFactory {
    /** Try providers in priority order, return first available. */
    static create(config, vectorRepo) {
        const service = EmbeddingFactory.tryOllama(config, vectorRepo);
        if (service)
            return service;
        const onnxService = EmbeddingFactory.tryOnnx(config, vectorRepo);
        if (onnxService)
            return onnxService;
        return null;
    }
    /** Attempt Ollama provider if URL is configured. */
    static tryOllama(config, vectorRepo) {
        if (!config.ollamaUrl)
            return null;
        const model = config.ollamaModel ?? 'nomic-embed-text';
        const client = createOllamaClient(config.ollamaUrl, model);
        if (!client.isAvailable())
            return null;
        const provider = new ollama_provider_js_1.OllamaEmbeddingProvider(client, model);
        log(`Embedding: Ollama (${model})`);
        return new service_js_1.EmbeddingService(provider, vectorRepo);
    }
    /** Attempt local ONNX provider if model files exist. */
    static tryOnnx(config, vectorRepo) {
        const modelPath = EmbeddingFactory.resolveModel(config.workspace);
        const vocabPath = EmbeddingFactory.resolveVocab(config.workspace);
        if (!modelPath || !vocabPath) {
            log('ONNX model not found. Place model.onnx + vocab.txt in .code-intel/models/');
            return null;
        }
        try {
            const provider = new onnx_provider_js_1.OnnxEmbeddingProvider(modelPath, vocabPath);
            if (!provider.isAvailable())
                return null;
            log('Embedding: ONNX local (all-MiniLM-L6-v2, 384d)');
            return new service_js_1.EmbeddingService(provider, vectorRepo);
        }
        catch (e) {
            log(`ONNX init failed: ${e.message}`);
            return null;
        }
    }
    /** Find model.onnx in workspace or home .code-intel/models/. */
    static resolveModel(workspace) {
        const candidates = [
            path.join(workspace, '.code-intel', 'models', 'model.onnx'),
            path.join(workspace, '.code-intel', 'models', 'all-MiniLM-L6-v2.onnx'),
            path.join(os.homedir(), '.code-intel', 'models', 'model.onnx'),
        ];
        return candidates.find(p => fs.existsSync(p)) ?? null;
    }
    /** Find vocab.txt in workspace or home .code-intel/models/. */
    static resolveVocab(workspace) {
        const candidates = [
            path.join(workspace, '.code-intel', 'models', 'vocab.txt'),
            path.join(os.homedir(), '.code-intel', 'models', 'vocab.txt'),
        ];
        return candidates.find(p => fs.existsSync(p)) ?? null;
    }
}
exports.EmbeddingFactory = EmbeddingFactory;
/** Create a minimal Ollama HTTP client for embeddings. */
function createOllamaClient(baseUrl, model) {
    return {
        async getEmbedding(text) {
            try {
                const url = `${baseUrl}/api/embeddings`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, prompt: text }),
                });
                if (!resp.ok)
                    return null;
                const data = await resp.json();
                return data.embedding ?? null;
            }
            catch {
                return null;
            }
        },
        isAvailable() {
            // Synchronous check — assume available if URL is configured
            return !!baseUrl;
        },
    };
}
function log(msg) {
    process.stderr.write(`[embed-factory] ${msg}\n`);
}
//# sourceMappingURL=factory.js.map