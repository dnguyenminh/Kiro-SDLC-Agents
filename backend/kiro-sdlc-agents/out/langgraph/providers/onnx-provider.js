"use strict";
/**
 * OnnxProvider — KSA-223
 * CPU-only local LLM provider using ONNX Runtime.
 * Supports small models (Phi-3-mini, SmolLM2) for offline/air-gapped use.
 * Model downloaded on-demand via extension command.
 *
 * Architecture:
 *   - Uses onnxruntime-node for CPU inference
 *   - Tokenizer + model weights stored in .code-intel/models/llm/
 *   - Streaming via chunked generation loop
 *   - No API key required — fully local
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
exports.OnnxProvider = exports.ONNX_MODEL_REGISTRY = void 0;
const path = __importStar(require("path"));
/** Default model configuration */
const DEFAULT_MODEL_ID = "phi-3-mini";
const MAX_CONTEXT_TOKENS = 2048;
const MAX_NEW_TOKENS = 512;
exports.ONNX_MODEL_REGISTRY = [
    {
        id: "phi-3-mini",
        displayName: "Phi-3 Mini (3.8B, Q4)",
        files: ["model.onnx", "model.onnx.data", "tokenizer.json", "tokenizer_config.json"],
        tokenizerFile: "tokenizer.json",
        modelFile: "model.onnx",
        contextLength: 2048,
    },
    {
        id: "smollm2-360m",
        displayName: "SmolLM2 (360M, FP16)",
        files: ["model.onnx", "tokenizer.json", "tokenizer_config.json"],
        tokenizerFile: "tokenizer.json",
        modelFile: "model.onnx",
        contextLength: 2048,
    },
];
class OnnxProvider {
    type = "ollama";
    session = null;
    tokenizer = null;
    modelDir;
    modelId;
    constructor(workspaceRoot, modelId) {
        this.modelId = modelId || DEFAULT_MODEL_ID;
        this.modelDir = path.join(workspaceRoot, ".code-intel", "models", "llm", this.modelId);
    }
    async chat(messages, options) {
        await this.ensureLoaded();
        const prompt = this.formatPrompt(messages);
        const inputIds = this.tokenizer.encode(prompt);
        const maxInput = Math.min(inputIds.length, MAX_CONTEXT_TOKENS);
        const truncated = inputIds.slice(-maxInput);
        const maxTokens = options?.maxTokens || MAX_NEW_TOKENS;
        const generated = await this.generate(truncated, maxTokens, options?.temperature ?? 0.7);
        return this.tokenizer.decode(generated);
    }
    async *chatStream(messages, options) {
        await this.ensureLoaded();
        const prompt = this.formatPrompt(messages);
        const inputIds = this.tokenizer.encode(prompt);
        const maxInput = Math.min(inputIds.length, MAX_CONTEXT_TOKENS);
        const truncated = inputIds.slice(-maxInput);
        const maxTokens = options?.maxTokens || MAX_NEW_TOKENS;
        let currentIds = [...truncated];
        let tokensGenerated = 0;
        while (tokensGenerated < maxTokens) {
            const nextToken = await this.predictNext(currentIds, options?.temperature ?? 0.7);
            if (nextToken === this.tokenizer.eosTokenId)
                break;
            currentIds.push(nextToken);
            tokensGenerated++;
            const text = this.tokenizer.decode([nextToken]);
            if (text)
                yield text;
        }
    }
    async isAvailable() {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require("fs")));
            const modelConfig = exports.ONNX_MODEL_REGISTRY.find(m => m.id === this.modelId);
            if (!modelConfig)
                return false;
            const modelPath = path.join(this.modelDir, modelConfig.modelFile);
            return fs.existsSync(modelPath);
        }
        catch {
            return false;
        }
    }
    dispose() {
        if (this.session) {
            this.session.release?.();
            this.session = null;
        }
        this.tokenizer = null;
    }
    async ensureLoaded() {
        if (this.session && this.tokenizer)
            return;
        const modelConfig = exports.ONNX_MODEL_REGISTRY.find(m => m.id === this.modelId);
        if (!modelConfig) {
            throw new Error(`Unknown ONNX model: ${this.modelId}. Available: ${exports.ONNX_MODEL_REGISTRY.map(m => m.id).join(", ")}`);
        }
        const tokenizerPath = path.join(this.modelDir, modelConfig.tokenizerFile);
        this.tokenizer = await OnnxTokenizer.load(tokenizerPath);
        const ort = await Promise.resolve(`${"onnxruntime-node"}`).then(s => __importStar(require(s))).catch(() => null);
        if (!ort) {
            throw new Error("onnxruntime-node not available. Install via: npm install onnxruntime-node");
        }
        const modelPath = path.join(this.modelDir, modelConfig.modelFile);
        this.session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ["cpu"],
            graphOptimizationLevel: "all",
        });
    }
    async generate(inputIds, maxNewTokens, temperature) {
        const generated = [];
        let currentIds = [...inputIds];
        for (let i = 0; i < maxNewTokens; i++) {
            const nextToken = await this.predictNext(currentIds, temperature);
            if (nextToken === this.tokenizer.eosTokenId)
                break;
            generated.push(nextToken);
            currentIds.push(nextToken);
        }
        return generated;
    }
    async predictNext(inputIds, temperature) {
        const ort = await Promise.resolve(`${"onnxruntime-node"}`).then(s => __importStar(require(s)));
        const inputTensor = new ort.Tensor("int64", BigInt64Array.from(inputIds.map(id => BigInt(id))), [1, inputIds.length]);
        const attentionMask = new ort.Tensor("int64", BigInt64Array.from(inputIds.map(() => 1n)), [1, inputIds.length]);
        const feeds = { input_ids: inputTensor, attention_mask: attentionMask };
        const results = await this.session.run(feeds);
        const logits = results.logits?.data || results[Object.keys(results)[0]]?.data;
        if (!logits)
            throw new Error("ONNX model did not return logits");
        const vocabSize = this.tokenizer.vocabSize;
        const lastTokenLogits = Array.from(logits).slice(-vocabSize);
        return this.sample(lastTokenLogits, temperature);
    }
    sample(logits, temperature) {
        if (temperature <= 0.01)
            return logits.indexOf(Math.max(...logits));
        const scaled = logits.map(l => l / temperature);
        const maxLogit = Math.max(...scaled);
        const exps = scaled.map(l => Math.exp(l - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map(e => e / sumExps);
        const rand = Math.random();
        let cumulative = 0;
        for (let i = 0; i < probs.length; i++) {
            cumulative += probs[i];
            if (rand < cumulative)
                return i;
        }
        return probs.length - 1;
    }
    formatPrompt(messages) {
        return messages
            .map(m => {
            switch (m.role) {
                case "system": return `<|system|>\n${m.content}<|end|>`;
                case "user": return `<|user|>\n${m.content}<|end|>`;
                case "assistant": return `<|assistant|>\n${m.content}<|end|>`;
                default: return m.content;
            }
        })
            .join("\n") + "\n<|assistant|>\n";
    }
}
exports.OnnxProvider = OnnxProvider;
class OnnxTokenizer {
    vocab;
    reverseVocab;
    vocabSize;
    eosTokenId;
    constructor(vocab, eosTokenId) {
        this.vocab = vocab;
        this.reverseVocab = new Map(Array.from(vocab.entries()).map(([k, v]) => [v, k]));
        this.vocabSize = vocab.size;
        this.eosTokenId = eosTokenId;
    }
    static async load(tokenizerPath) {
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        const raw = fs.readFileSync(tokenizerPath, "utf-8");
        const config = JSON.parse(raw);
        const vocab = new Map();
        const model = config.model || {};
        if (model.vocab) {
            for (const [token, id] of Object.entries(model.vocab)) {
                vocab.set(token, id);
            }
        }
        else if (config.added_tokens) {
            for (const token of config.added_tokens) {
                vocab.set(token.content, token.id);
            }
        }
        const eosId = vocab.get("<|end|>") ?? vocab.get("</s>") ?? vocab.get("<|endoftext|>") ?? 0;
        return new OnnxTokenizer(vocab, eosId);
    }
    encode(text) {
        const tokens = [];
        const words = text.split(/(\s+)/);
        for (const word of words) {
            const id = this.vocab.get(word);
            if (id !== undefined) {
                tokens.push(id);
            }
            else {
                for (const char of word) {
                    tokens.push(this.vocab.get(char) ?? 0);
                }
            }
        }
        return tokens;
    }
    decode(tokenIds) {
        return tokenIds.map(id => this.reverseVocab.get(id) || "").join("");
    }
}
//# sourceMappingURL=onnx-provider.js.map