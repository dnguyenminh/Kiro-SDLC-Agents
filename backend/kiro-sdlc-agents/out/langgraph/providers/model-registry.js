"use strict";
/**
 * ModelRegistry — KSA-231
 * Fetches and caches available models from Kiro API with 1-hour TTL.
 * Supports ETag conditional requests for bandwidth efficiency.
 * Integrates with VS Code settings for model selection persistence.
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
const vscode = __importStar(require("vscode"));
const anthropic_adapter_1 = require("./anthropic-adapter");
// ─── Constants ────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — force refresh when Settings opened
const REQUEST_TIMEOUT_MS = 10_000;
// ─── ModelRegistry ────────────────────────────────────────────────────────────
class ModelRegistry {
    cache = null;
    backgroundRefreshInProgress = false;
    adapter = new anthropic_adapter_1.AnthropicAdapter();
    _onModelsChanged = new vscode.EventEmitter();
    onModelsChanged = this._onModelsChanged.event;
    tokenManager;
    outputChannel;
    constructor(tokenManager, outputChannel) {
        this.tokenManager = tokenManager;
        this.outputChannel = outputChannel;
    }
    // ─── Public API ───────────────────────────────────────────────────────────
    /**
     * Get available models. Uses cache when valid, otherwise fetches from API.
     * @param forceRefresh - bypass cache TTL and fetch fresh
     */
    async getModels(forceRefresh = false) {
        const now = Date.now();
        // If force refresh requested or no cache exists
        if (forceRefresh || !this.cache) {
            return this.fetchModels();
        }
        const cacheAge = now - this.cache.fetchedAt;
        // Cache < 5 minutes: return immediately
        if (cacheAge < STALE_THRESHOLD_MS) {
            return this.cache.models;
        }
        // Cache 5min–1h: return cached, background refresh
        if (cacheAge < CACHE_TTL_MS) {
            this.backgroundRefresh();
            return this.cache.models;
        }
        // Cache > 1h: block on refresh
        return this.fetchModels();
    }
    /**
     * Get the currently selected model ID from VS Code settings.
     */
    getSelectedModel() {
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        return config.get("kiroModel", "");
    }
    /**
     * Persist model selection to VS Code settings.
     */
    async setSelectedModel(modelId) {
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        await config.update("kiroModel", modelId, vscode.ConfigurationTarget.Global);
    }
    dispose() {
        this._onModelsChanged.dispose();
    }
    // ─── Internal ─────────────────────────────────────────────────────────────
    async fetchModels() {
        try {
            // SINGLE SOURCE OF TRUTH (KSA-237): read models from the local kiro-ts
            // gateway `/v1/models`, which in turn calls the REAL Kiro backend
            // (CodeWhisperer ListAvailableModels) with a static fallback. The old
            // `kiro.api.{region}.amazonaws.com/v1/models` host is DEAD (no DNS), so
            // we no longer call it. No bearer token needed — the gateway binds to
            // 127.0.0.1 and resolves Kiro SSO credentials itself.
            const port = vscode.workspace.getConfiguration("kiroSdlc").get("mcpServerPort", 9181);
            const url = this.adapter.getModelsEndpointUrl(port);
            const headers = {
                "Content-Type": "application/json",
            };
            // Conditional request with ETag (gateway may not send one — harmless).
            if (this.cache?.etag) {
                headers["If-None-Match"] = this.cache.etag;
            }
            const response = await fetch(url, {
                method: "GET",
                headers,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            // 304 Not Modified — cache is still valid
            if (response.status === 304) {
                this.cache.fetchedAt = Date.now();
                return this.cache.models;
            }
            if (!response.ok) {
                this.log("WARN", `Models gateway returned ${response.status}`);
                return this.cache?.models || [];
            }
            const data = await response.json();
            const models = this.parseModelsResponse(data);
            const etag = response.headers.get("ETag") || null;
            const previousModels = this.cache?.models || [];
            this.cache = {
                models,
                fetchedAt: Date.now(),
                etag,
            };
            // Notify if models changed
            if (this.modelsChanged(previousModels, models)) {
                this._onModelsChanged.fire(models);
                this.log("INFO", `Models updated: ${models.length} models`);
            }
            // If no model selected yet, auto-select first chat-capable model
            const selected = this.getSelectedModel();
            if (!selected && models.length > 0) {
                const defaultModel = models.find(m => m.capabilities.chat) || models[0];
                await this.setSelectedModel(defaultModel.id);
            }
            return models;
        }
        catch (err) {
            this.log("ERROR", `Failed to fetch models: ${err.message}`);
            // Return cached if available
            if (this.cache) {
                return this.cache.models;
            }
            return [];
        }
    }
    backgroundRefresh() {
        if (this.backgroundRefreshInProgress) {
            return;
        }
        this.backgroundRefreshInProgress = true;
        this.fetchModels().finally(() => {
            this.backgroundRefreshInProgress = false;
        });
    }
    parseModelsResponse(data) {
        // Gateway /v1/models returns the Anthropic envelope: { data: [{ id, display_name }] }.
        // Older Kiro API shape was { models: [{ id, displayName, ... }] }. Support both.
        if (Array.isArray(data.data)) {
            return data.data
                .filter((m) => m.id)
                .map((m) => ({
                id: m.id,
                displayName: m.display_name || m.displayName || m.id,
                provider: "kiro",
                contextWindow: m.contextWindow || 0,
                capabilities: {
                    chat: m.capabilities?.chat ?? true,
                    code: m.capabilities?.code ?? false,
                    vision: m.capabilities?.vision ?? false,
                },
                maxOutputTokens: m.maxOutputTokens || undefined,
            }));
        }
        if (!data.models || !Array.isArray(data.models)) {
            return [];
        }
        return data.models
            .filter((m) => m.id && m.displayName)
            .map((m) => ({
            id: m.id,
            displayName: m.displayName || m.id,
            provider: m.provider || "unknown",
            capabilities: {
                chat: m.capabilities?.chat ?? true,
                code: m.capabilities?.code ?? false,
                vision: m.capabilities?.vision ?? false,
            },
            contextWindow: m.contextWindow || 0,
            maxOutputTokens: m.maxOutputTokens || undefined,
        }));
    }
    modelsChanged(prev, next) {
        if (prev.length !== next.length) {
            return true;
        }
        const prevIds = new Set(prev.map(m => m.id));
        return next.some(m => !prevIds.has(m.id));
    }
    log(level, message) {
        this.outputChannel.appendLine(`[${level}] ModelRegistry: ${message}`);
    }
}
exports.ModelRegistry = ModelRegistry;
//# sourceMappingURL=model-registry.js.map