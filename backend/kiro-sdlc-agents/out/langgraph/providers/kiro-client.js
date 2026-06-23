"use strict";
/**
 * KiroClient — KSA-231
 * Main LlmProvider implementation for the Kiro API.
 * Orchestrates TokenManager, AnthropicAdapter, StreamHandler, and ModelRegistry
 * to provide seamless LLM integration without external dependencies or processes.
 *
 * Replaces the external kiro-rs proxy with native TypeScript modules.
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
exports.KiroApiError = exports.KiroClient = void 0;
const vscode = __importStar(require("vscode"));
const token_manager_1 = require("./token-manager");
const anthropic_adapter_1 = require("./anthropic-adapter");
const stream_handler_1 = require("./stream-handler");
const model_registry_1 = require("./model-registry");
// ─── Constants ────────────────────────────────────────────────────────────────
const CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 4096;
// ─── KiroClient ───────────────────────────────────────────────────────────────
class KiroClient {
    type = "kiro";
    tokenManager;
    adapter;
    streamHandler;
    modelRegistry;
    outputChannel;
    initialized = false;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.tokenManager = new token_manager_1.TokenManager(outputChannel);
        this.adapter = new anthropic_adapter_1.AnthropicAdapter();
        this.streamHandler = new stream_handler_1.StreamHandler();
        this.modelRegistry = new model_registry_1.ModelRegistry(this.tokenManager, outputChannel);
    }
    // ─── LlmProvider Interface ────────────────────────────────────────────────
    /**
     * Non-streaming chat completion. Collects all streamed chunks into a single string.
     */
    async chat(messages, options) {
        await this.ensureInitialized();
        const result = [];
        for await (const chunk of this.chatStream(messages, options)) {
            result.push(chunk);
        }
        return result.join("");
    }
    /**
     * Streaming chat completion. Yields text deltas as they arrive from SSE.
     */
    async *chatStream(messages, options) {
        await this.ensureInitialized();
        const model = await this.resolveModel(options?.model);
        const region = this.tokenManager.getRegion();
        if (!region) {
            throw new KiroApiError("No region available. Check credentials or kiroSdlc.kiroRegion setting.");
        }
        const requestBody = this.adapter.buildRequestBody(messages, { ...options, model });
        requestBody.stream = true;
        const response = await this.sendRequest(region, model, requestBody, options?.signal);
        this.log("INFO", `Chat request: model=${model}, messages=${messages.length}, stream=true`);
        const startTime = Date.now();
        let tokenCount = 0;
        for await (const chunk of this.streamHandler.processStream(response, options?.signal)) {
            yield chunk;
            tokenCount++;
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log("INFO", `Stream complete: ~${tokenCount} chunks in ${duration}s`);
    }
    /**
     * Chat with tool calling support.
     * Sends request with tools and parses response for tool_use blocks.
     */
    /**
     * Chat with tool calling support via streaming (KSA-235).
     * Uses streaming mode and processStreamWithToolUse to collect tool_use blocks.
     */
    async chatWithTools(messages, tools, options) {
        await this.ensureInitialized();
        const model = await this.resolveModel(options?.model);
        const region = this.tokenManager.getRegion();
        if (!region) {
            throw new KiroApiError("No region available. Check credentials or kiroSdlc.kiroRegion setting.");
        }
        const requestBody = this.adapter.buildRequestBody(messages, { ...options, model }, tools);
        requestBody.stream = true;
        const response = await this.sendRequest(region, model, requestBody, options?.signal);
        this.log("INFO", `Chat request (tools+stream): model=${model}, messages=${messages.length}, tools=${tools.length}`);
        // Collect streaming events into structured response
        let textBuffer = "";
        const toolCalls = [];
        for await (const event of this.streamHandler.processStreamWithToolUse(response, options?.signal)) {
            if (event.type === "text") {
                textBuffer += event.text;
            }
            else if (event.type === "tool_use") {
                toolCalls.push({
                    id: event.id,
                    name: event.name,
                    arguments: event.input,
                });
            }
        }
        if (toolCalls.length > 0) {
            return { type: "tool_use", toolCalls };
        }
        return { type: "text", text: textBuffer };
    }
    /**
     * Check if the Kiro provider is available (valid credentials exist).
     */
    async isAvailable() {
        try {
            await this.ensureInitialized();
            const status = this.tokenManager.getStatus();
            return status === "active" || status === "refreshing";
        }
        catch {
            return false;
        }
    }
    /**
     * Dispose all held resources — timers, watchers, credential memory.
     */
    dispose() {
        this.tokenManager.dispose();
        this.modelRegistry.dispose();
        this.outputChannel.appendLine("[INFO] KiroClient: disposed");
    }
    // ─── Public Accessors ─────────────────────────────────────────────────────
    /** Access the model registry for model list operations. */
    getModelRegistry() {
        return this.modelRegistry;
    }
    /** Access the token manager for status monitoring. */
    getTokenManager() {
        return this.tokenManager;
    }
    // ─── Internal ─────────────────────────────────────────────────────────────
    async ensureInitialized() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        await this.tokenManager.initialize();
    }
    /**
     * Resolve which model to use:
     * 1. Explicit option passed by caller
     * 2. VS Code setting kiroSdlc.kiroModel
     * 3. First available from ModelRegistry
     */
    async resolveModel(explicitModel) {
        if (explicitModel) {
            return explicitModel;
        }
        const settingsModel = this.modelRegistry.getSelectedModel();
        if (settingsModel) {
            return settingsModel;
        }
        // Try to get first available model
        const models = await this.modelRegistry.getModels();
        if (models.length > 0) {
            const chatModel = models.find(m => m.capabilities.chat) || models[0];
            return chatModel.id;
        }
        // Fallback — let API decide (it may have a default)
        return "";
    }
    /**
     * Send streaming request to the Kiro chat backend with automatic 401 retry.
     *
     * KSA-237: routes through the local kiro-ts gateway (127.0.0.1:{port}) instead
     * of the dead `kiro.api.{region}` host. `region` is retained for signature
     * compatibility but no longer used to build the URL.
     */
    async sendRequest(region, model, body, signal) {
        const accessToken = await this.tokenManager.getAccessToken();
        const port = vscode.workspace.getConfiguration("kiroSdlc").get("mcpServerPort", 9181);
        const url = this.adapter.getEndpointUrl(port);
        const headers = this.adapter.buildRequestHeaders(accessToken, model);
        let response = await this.fetchWithTimeout(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal,
        });
        // 401: refresh token and retry once
        if (response.status === 401) {
            this.log("WARN", "Received 401 — refreshing token and retrying");
            await this.tokenManager.refreshToken();
            const newToken = await this.tokenManager.getAccessToken();
            const newHeaders = this.adapter.buildRequestHeaders(newToken, model);
            response = await this.fetchWithTimeout(url, {
                method: "POST",
                headers: newHeaders,
                body: JSON.stringify(body),
                signal,
            });
            if (response.status === 401) {
                throw new KiroApiError("Authentication failed after token refresh. Please re-login via Kiro IDE.");
            }
        }
        // Handle rate limiting
        if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
            this.log("WARN", `Rate limited (429). Waiting ${waitMs}ms`);
            await this.sleep(waitMs);
            const refreshedToken = await this.tokenManager.getAccessToken();
            const retryHeaders = this.adapter.buildRequestHeaders(refreshedToken, model);
            response = await this.fetchWithTimeout(url, {
                method: "POST",
                headers: retryHeaders,
                body: JSON.stringify(body),
                signal,
            });
        }
        // Handle server errors with retry
        if (response.status >= 500) {
            this.log("WARN", `Server error ${response.status} — retrying once`);
            await this.sleep(1000);
            const refreshedToken = await this.tokenManager.getAccessToken();
            const retryHeaders = this.adapter.buildRequestHeaders(refreshedToken, model);
            response = await this.fetchWithTimeout(url, {
                method: "POST",
                headers: retryHeaders,
                body: JSON.stringify(body),
                signal,
            });
        }
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new KiroApiError(`Kiro API error ${response.status}: ${errorText}`);
        }
        return response;
    }
    /**
     * Fetch with connect timeout.
     */
    async fetchWithTimeout(url, init) {
        // Use AbortSignal.timeout for connect timeout, but respect existing signal too
        const existingSignal = init.signal;
        if (!existingSignal) {
            return fetch(url, { ...init, signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS) });
        }
        // Combine: abort if either the user signal or timeout fires
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
        existingSignal.addEventListener("abort", () => controller.abort());
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Fetch with retry for non-streaming requests (chatWithTools).
     */
    async fetchWithRetry(url, init) {
        let response = await this.fetchWithTimeout(url, init);
        // 401: refresh and retry once
        if (response.status === 401) {
            this.log("WARN", "Received 401 on tool call — refreshing token");
            await this.tokenManager.refreshToken();
            const newToken = await this.tokenManager.getAccessToken();
            const headers = { ...init.headers };
            headers["Authorization"] = `Bearer ${newToken}`;
            response = await this.fetchWithTimeout(url, { ...init, headers });
        }
        // 429: wait and retry
        if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
            await this.sleep(waitMs);
            response = await this.fetchWithTimeout(url, init);
        }
        // 5xx: retry once
        if (response.status >= 500) {
            await this.sleep(1000);
            response = await this.fetchWithTimeout(url, init);
        }
        return response;
    }
    log(level, message) {
        this.outputChannel.appendLine(`[${level}] KiroClient: ${message}`);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.KiroClient = KiroClient;
// ─── Error Class ──────────────────────────────────────────────────────────────
class KiroApiError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "KiroApiError";
    }
}
exports.KiroApiError = KiroApiError;
//# sourceMappingURL=kiro-client.js.map