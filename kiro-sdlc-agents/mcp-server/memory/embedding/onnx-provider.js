"use strict";
/**
 * ONNX Runtime embedding provider for all-MiniLM-L6-v2.
 * Lazy loads model on first embed call. Uses mean pooling + L2 normalize.
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
exports.OnnxEmbeddingProvider = void 0;
const fs = __importStar(require("fs"));
const tokenizer_js_1 = require("./tokenizer.js");
const MAX_SEQ_LENGTH = 128;
class OnnxEmbeddingProvider {
    modelPath;
    vocabPath;
    session = null;
    tokenizer = null;
    constructor(modelPath, vocabPath) {
        this.modelPath = modelPath;
        this.vocabPath = vocabPath;
    }
    get modelName() {
        return 'all-MiniLM-L6-v2';
    }
    get dimensions() {
        return 384;
    }
    async embed(text) {
        try {
            await this.ensureLoaded();
            return await this.runInference(text);
        }
        catch (e) {
            log(`ONNX embed error: ${e.message}`);
            return null;
        }
    }
    async embedBatch(texts) {
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text));
        }
        return results;
    }
    isAvailable() {
        return fs.existsSync(this.modelPath) && fs.existsSync(this.vocabPath);
    }
    close() {
        this.session = null;
        this.tokenizer = null;
    }
    /** Lazy-load ONNX model on first use. */
    async ensureLoaded() {
        if (this.session !== null)
            return;
        let ort;
        try {
            // Try loading from ONNX_RUNTIME_PATH (prebuilt binary from extension or bootstrap)
            let onnxPath = process.env.ONNX_RUNTIME_PATH;
            // If not set, try self-download via bootstrap
            if (!onnxPath) {
                try {
                    const { ensureOnnxRuntime } = require('./onnx-bootstrap.js');
                    const bootstrapPath = await ensureOnnxRuntime();
                    if (bootstrapPath) {
                        onnxPath = bootstrapPath;
                    }
                }
                catch { /* bootstrap not available */ }
            }
            if (onnxPath) {
                ort = require(onnxPath);
            }
            else {
                // @ts-ignore — onnxruntime-node is an optional dependency
                ort = await import('onnxruntime-node');
            }
        }
        catch {
            throw new Error('onnxruntime-node not installed. Install with: npm install onnxruntime-node');
        }
        this.session = await ort.InferenceSession.create(this.modelPath);
        this.tokenizer = new tokenizer_js_1.Tokenizer(this.vocabPath);
        log(`ONNX model loaded: ${this.modelPath}`);
    }
    /** Tokenize, run ONNX, mean-pool, normalize. */
    async runInference(text) {
        // Use ONNX_RUNTIME_PATH (already resolved by ensureLoaded)
        const onnxPath = process.env.ONNX_RUNTIME_PATH;
        // @ts-ignore — onnxruntime-node is an optional dependency
        const ort = onnxPath
            ? require(onnxPath)
            : await import('onnxruntime-node');
        const encoded = this.tokenizer.encode(text, MAX_SEQ_LENGTH);
        const feeds = {
            input_ids: new ort.Tensor('int64', encoded.inputIds, [1, MAX_SEQ_LENGTH]),
            attention_mask: new ort.Tensor('int64', encoded.attentionMask, [1, MAX_SEQ_LENGTH]),
            token_type_ids: new ort.Tensor('int64', encoded.tokenTypeIds, [1, MAX_SEQ_LENGTH]),
        };
        const results = await this.session.run(feeds);
        const outputKey = Object.keys(results)[0];
        const outputData = results[outputKey].data;
        // Shape: [1, seq_len, 384] — extract token embeddings
        const tokenEmbeddings = this.reshapeOutput(outputData, MAX_SEQ_LENGTH, 384);
        const pooled = this.meanPool(tokenEmbeddings, encoded.attentionMask);
        return this.normalize(pooled);
    }
    /** Reshape flat output to [seq_len][dims]. */
    reshapeOutput(data, seqLen, dims) {
        const result = [];
        for (let i = 0; i < seqLen; i++) {
            const row = [];
            for (let j = 0; j < dims; j++) {
                row.push(data[i * dims + j]);
            }
            result.push(row);
        }
        return result;
    }
    /** Mean pooling over non-padding tokens. */
    meanPool(embeddings, mask) {
        const dims = embeddings[0].length;
        const summed = new Array(dims).fill(0);
        let count = 0;
        for (let i = 0; i < embeddings.length; i++) {
            if (mask[i] === 1n) {
                for (let j = 0; j < dims; j++) {
                    summed[j] += embeddings[i][j];
                }
                count++;
            }
        }
        const divisor = Math.max(count, 1);
        return summed.map(v => v / divisor);
    }
    /** L2 normalize vector. */
    normalize(vector) {
        const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        if (norm === 0)
            return vector;
        return vector.map(v => v / norm);
    }
}
exports.OnnxEmbeddingProvider = OnnxEmbeddingProvider;
function log(msg) {
    process.stderr.write(`[onnx-embed] ${msg}\n`);
}
//# sourceMappingURL=onnx-provider.js.map