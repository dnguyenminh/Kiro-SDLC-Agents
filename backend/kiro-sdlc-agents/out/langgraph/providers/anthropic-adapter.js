"use strict";
/**
 * AnthropicAdapter — KSA-231
 * Maps between the extension's LlmMessage[] format and Kiro API's Anthropic-compatible
 * request/response format. Handles system prompt extraction, tool message conversion,
 * and response parsing.
 *
 * NOTE: This is a NEW file for Kiro-specific adaptation — separate from anthropic-provider.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAdapter = void 0;
// ─── Constants ──────────────────────────────────────────────────────────────
/** Default local kiro-ts gateway port (kiroSdlc.mcpServerPort default). */
const DEFAULT_GATEWAY_PORT = 9181;
// ─── AnthropicAdapter ─────────────────────────────────────────────────────────
class AnthropicAdapter {
    defaultModel;
    defaultMaxTokens;
    constructor(defaultModel = "", defaultMaxTokens = 4096) {
        this.defaultModel = defaultModel;
        this.defaultMaxTokens = defaultMaxTokens;
    }
    /**
     * Build the request body for Kiro API (Anthropic Messages format).
     * Extracts system messages, maps tool results, and applies options.
     */
    buildRequestBody(messages, options, tools) {
        const { systemPrompt, userMessages } = this.splitMessages(messages);
        const body = {
            model: options?.model || this.defaultModel,
            max_tokens: options?.maxTokens || this.defaultMaxTokens,
            messages: this.formatMessages(userMessages),
        };
        if (systemPrompt) {
            body.system = systemPrompt;
        }
        if (options?.temperature !== undefined) {
            body.temperature = options.temperature;
        }
        if (tools && tools.length > 0) {
            body.tools = tools.map(t => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
            }));
        }
        return body;
    }
    /**
     * Build request headers for Kiro API.
     */
    buildRequestHeaders(accessToken, modelId) {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "X-Model-Id": modelId,
            "Accept": "text/event-stream",
        };
    }
    /**
     * Build non-streaming request headers (no Accept: text/event-stream).
     */
    buildNonStreamHeaders(accessToken, modelId) {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "X-Model-Id": modelId,
        };
    }
    /**
     * Parse a non-streaming JSON response into LlmResponse.
     */
    parseNonStreamResponse(json) {
        if (!json.content || !Array.isArray(json.content)) {
            return { type: "text", text: "" };
        }
        // Check for tool_use blocks
        const toolUseBlocks = json.content.filter((block) => block.type === "tool_use");
        if (toolUseBlocks.length > 0) {
            const toolCalls = toolUseBlocks.map((block) => ({
                id: block.id,
                name: block.name,
                arguments: block.input || {},
            }));
            return { type: "tool_use", toolCalls };
        }
        // Text response — concatenate all text blocks
        const text = json.content
            .filter((block) => block.type === "text")
            .map((block) => block.text || "")
            .join("");
        return { type: "text", text };
    }
    /**
     * Get the Kiro API endpoint URL for chat (Anthropic Messages format).
     *
     * KSA-237: the legacy host `kiro.api.{region}.amazonaws.com` is DEAD (no
     * DNS). Chat now flows through the local kiro-ts gateway, which signs/forwards
     * to the real CodeWhisperer backend. A region string is accepted for backward
     * compatibility but ignored; pass the gateway port (number) instead.
     */
    getEndpointUrl(portOrRegion) {
        const port = typeof portOrRegion === "number" ? portOrRegion : DEFAULT_GATEWAY_PORT;
        return `http://127.0.0.1:${port}/v1/messages`;
    }
    /**
     * Get the model listing endpoint URL.
     *
     * KSA-237: SINGLE SOURCE OF TRUTH — the local kiro-ts gateway `/v1/models`.
     * The old `kiro.api.{region}.amazonaws.com/v1/models` host never resolved.
     */
    getModelsEndpointUrl(port = DEFAULT_GATEWAY_PORT) {
        return `http://127.0.0.1:${port}/v1/models`;
    }
    // ─── Internal ─────────────────────────────────────────────────────────────
    /**
     * Split system messages from user/assistant/tool messages.
     * Anthropic API expects system prompt separate from messages array.
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
     * Format messages for Kiro API.
     * Handles tool result messages and assistant tool_use messages.
     */
    formatMessages(messages) {
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
                // Check if this is a tool_use assistant message (JSON array of tool_use blocks)
                const toolUseBlocks = this.tryParseToolUseBlocks(msg.content);
                if (toolUseBlocks) {
                    formatted.push({ role: "assistant", content: toolUseBlocks });
                }
                else {
                    formatted.push({ role: "assistant", content: msg.content });
                }
            }
            else {
                formatted.push({ role: "user", content: msg.content });
            }
        }
        return formatted;
    }
    /**
     * Try to parse assistant content as tool_use blocks array.
     * Returns parsed array if valid, null otherwise.
     */
    tryParseToolUseBlocks(content) {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type === "tool_use") {
                return parsed;
            }
        }
        catch { /* not JSON — regular text content */ }
        return null;
    }
}
exports.AnthropicAdapter = AnthropicAdapter;
//# sourceMappingURL=anthropic-adapter.js.map