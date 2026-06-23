"use strict";
/**
 * LLM Provider Factory — KSA-210
 * Creates provider instances based on VS Code configuration.
 * Providers are lazy-loaded to minimize extension activation cost.
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
exports.createLlmProvider = createLlmProvider;
exports.createProviderByType = createProviderByType;
exports.getSecretKeyForProvider = getSecretKeyForProvider;
const vscode = __importStar(require("vscode"));
/** VS Code secret keys for each provider */
const SECRET_KEYS = {
    anthropic: "kiroSdlc.anthropicApiKey",
    openai: "kiroSdlc.openaiApiKey",
};
/**
 * Create an LlmProvider from VS Code settings.
 * Reads kiroSdlc.llmProvider, kiroSdlc.llmModel, kiroSdlc.ollamaUrl from workspace config.
 */
function createLlmProvider(secrets) {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const providerType = config.get("llmProvider", "anthropic");
    const customModel = config.get("llmModel", "");
    const ollamaUrl = config.get("ollamaUrl", "http://localhost:11434");
    const anthropicBaseUrl = config.get("anthropicBaseUrl", "");
    const openaiBaseUrl = config.get("openaiBaseUrl", "");
    return createProviderByType(providerType, secrets, customModel, ollamaUrl, anthropicBaseUrl, openaiBaseUrl);
}
/**
 * Create a specific provider type with explicit configuration.
 */
function createProviderByType(type, secrets, customModel, ollamaUrl, anthropicBaseUrl, openaiBaseUrl) {
    switch (type) {
        case "anthropic": {
            const { AnthropicProvider } = require("./anthropic-provider");
            return new AnthropicProvider(secrets ? () => secrets.get(SECRET_KEYS.anthropic) : () => Promise.resolve(undefined), anthropicBaseUrl || undefined);
        }
        case "openai": {
            const { OpenAIProvider } = require("./openai-provider");
            return new OpenAIProvider(secrets ? () => secrets.get(SECRET_KEYS.openai) : () => Promise.resolve(undefined), openaiBaseUrl || undefined);
        }
        case "ollama": {
            const { OllamaProvider } = require("./ollama-provider");
            return new OllamaProvider(ollamaUrl, customModel || undefined);
        }
        case "onnx": {
            const { OnnxProvider } = require("./onnx-provider");
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ".";
            return new OnnxProvider(workspaceRoot, customModel || undefined);
        }
        case "kiro": {
            // Backward compat — alias "kiro" to anthropic + the configured gateway
            // base URL. The gateway now runs as the standalone Kiro Gateway extension
            // (default http://127.0.0.1:8990/anthropic via kiroSdlc.anthropicBaseUrl).
            const config2 = vscode.workspace.getConfiguration("kiroSdlc");
            const gatewayUrl = anthropicBaseUrl || config2.get("anthropicBaseUrl", "http://127.0.0.1:8990/anthropic");
            const { AnthropicProvider } = require("./anthropic-provider");
            return new AnthropicProvider(secrets ? () => secrets.get(SECRET_KEYS.anthropic) : () => Promise.resolve(undefined), gatewayUrl);
        }
        default:
            throw new Error(`Unknown LLM provider type: ${type}`);
    }
}
/**
 * Get the secret storage key for a given provider type.
 */
function getSecretKeyForProvider(type) {
    return SECRET_KEYS[type];
}
//# sourceMappingURL=index.js.map