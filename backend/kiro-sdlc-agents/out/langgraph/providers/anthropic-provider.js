"use strict";
/**
 * AnthropicProvider — KSA-210
 * LLM provider backed by the Anthropic Messages API via @anthropic-ai/sdk.
 * API key stored in VS Code SecretStorage (never in settings/state).
 * Supports native tool_use for ReAct agent loop.
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
exports.AnthropicProvider = exports.ANTHROPIC_SECRET_KEY = void 0;
/** Secret key used in VS Code SecretStorage */
exports.ANTHROPIC_SECRET_KEY = "kiroSdlc.anthropicApiKey";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 4096;
class AnthropicProvider {
    type = "anthropic";
    client = null;
    getApiKey;
    baseUrl;
    constructor(getApiKey, baseUrl) {
        this.getApiKey = getApiKey;
        this.baseUrl = baseUrl || undefined;
    }
    async chat(messages, options) {
        const client = await this.ensureClient();
        const { systemPrompt, userMessages } = this.splitMessages(messages);
        const params = {
            model: options?.model || DEFAULT_MODEL,
            max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
            messages: userMessages.map(m => ({ role: m.role, content: m.content })),
            // Force non-streaming so the SDK parses a single JSON body. A gateway
            // base URL defaults to SSE when `stream` is omitted, which the SDK then
            // cannot parse as JSON -> empty content -> empty chat bubble (KSA-237).
            stream: false,
        };
        if (systemPrompt) {
            params.system = systemPrompt;
        }
        if (options?.temperature !== undefined) {
            params.temperature = options.temperature;
        }
        const response = await client.messages.create(params);
        // Guard: upstream may return a body without a content array (error shape,
        // streaming-only response, or non-standard gateway payload).
        const content = Array.isArray(response?.content) ? response.content : [];
        return content
            .filter((block) => block.type === "text")
            .map((block) => block.text || "")
            .join("");
    }
    async *chatStream(messages, options) {
        const client = await this.ensureClient();
        const { systemPrompt, userMessages } = this.splitMessages(messages);
        const params = {
            model: options?.model || DEFAULT_MODEL,
            max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
            messages: userMessages.map(m => ({ role: m.role, content: m.content })),
            stream: true,
        };
        if (systemPrompt) {
            params.system = systemPrompt;
        }
        if (options?.temperature !== undefined) {
            params.temperature = options.temperature;
        }
        const stream = client.messages.stream(params);
        for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta?.text) {
                yield event.delta.text;
            }
        }
    }
    /**
     * Chat with tool calling support using Anthropic native tool_use.
     * Tools are passed directly in the API request.
     * Response may contain tool_use content blocks.
     */
    async chatWithTools(messages, tools, options) {
        const client = await this.ensureClient();
        const { systemPrompt, userMessages } = this.splitMessages(messages);
        // Convert tools to Anthropic format
        const anthropicTools = tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
        }));
        // Build messages — handle tool result messages specially for Anthropic format
        const formattedMessages = this.formatMessagesForTools(userMessages);
        const params = {
            model: options?.model || DEFAULT_MODEL,
            max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
            messages: formattedMessages,
            tools: anthropicTools,
            // Force non-streaming so the SDK parses a single JSON body. A gateway
            // base URL defaults to SSE when `stream` is omitted, which the SDK then
            // cannot parse as JSON -> empty content -> "active" status only (KSA-237).
            stream: false,
        };
        if (systemPrompt) {
            params.system = systemPrompt;
        }
        if (options?.temperature !== undefined) {
            params.temperature = options.temperature;
        }
        const response = await client.messages.create(params);
        // Guard: upstream may return a body without a content array.
        const content = Array.isArray(response?.content) ? response.content : [];
        // Check if response contains tool_use blocks
        const toolUseBlocks = content.filter((block) => block.type === "tool_use");
        if (toolUseBlocks.length > 0) {
            const toolCalls = toolUseBlocks.map((block) => ({
                id: block.id,
                name: block.name,
                arguments: block.input || {},
            }));
            return { type: "tool_use", toolCalls };
        }
        // Text response
        const text = content
            .filter((block) => block.type === "text")
            .map((block) => block.text || "")
            .join("");
        return { type: "text", text };
    }
    async isAvailable() {
        try {
            // Available if key exists OR custom baseUrl is configured (no key needed)
            const key = await this.getApiKey();
            return !!key || !!this.baseUrl;
        }
        catch {
            return false;
        }
    }
    dispose() {
        this.client = null;
    }
    async ensureClient() {
        if (this.client) {
            return this.client;
        }
        const apiKey = await this.getApiKey();
        if (!apiKey && !this.baseUrl) {
            throw new Error("Anthropic API key not configured. Run 'Kiro SDLC: Set LLM API Key' command.");
        }
        // Lazy-load SDK to minimize activation cost
        const { default: Anthropic } = await Promise.resolve().then(() => __importStar(require("@anthropic-ai/sdk")));
        const options = {};
        if (apiKey) {
            options.apiKey = apiKey;
        }
        if (this.baseUrl) {
            options.baseURL = this.baseUrl;
        }
        // If no key but custom URL, pass dummy key (SDK requires it) — header won't be sent by endpoint
        if (!apiKey && this.baseUrl) {
            options.apiKey = "not-needed";
        }
        this.client = new Anthropic(options);
        return this.client;
    }
    /**
     * Anthropic API expects system prompt separate from messages.
     * Split system messages from user/assistant messages.
     */
    splitMessages(messages) {
        const systemMsgs = messages.filter(m => m.role === "system");
        const userMessages = messages.filter(m => m.role !== "system");
        const systemPrompt = systemMsgs.length > 0
            ? systemMsgs.map(m => m.content).join("\n\n")
            : undefined;
        return { systemPrompt, userMessages };
    }
    /**
     * Format messages for Anthropic tool calling.
     * Converts tool result messages into Anthropic's expected format:
     * { role: "user", content: [{ type: "tool_result", tool_use_id, content }] }
     */
    formatMessagesForTools(messages) {
        const formatted = [];
        for (const msg of messages) {
            if (msg.role === "tool") {
                // Anthropic expects tool results wrapped in a user message
                formatted.push({
                    role: "user",
                    content: [{
                            type: "tool_result",
                            tool_use_id: msg.toolCallId || "unknown",
                            content: msg.content,
                        }],
                });
            }
            else if (msg.role === "assistant") {
                formatted.push({ role: "assistant", content: msg.content });
            }
            else {
                formatted.push({ role: "user", content: msg.content });
            }
        }
        return formatted;
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic-provider.js.map