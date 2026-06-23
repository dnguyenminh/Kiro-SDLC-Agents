"use strict";
/**
 * OllamaProvider — KSA-210
 * LLM provider backed by Ollama REST API (local inference).
 * No API key required. Uses fetch() for zero-dependency HTTP calls.
 * Supports tool calling via /api/chat with tools parameter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = void 0;
const DEFAULT_MODEL = "llama3.1";
const DEFAULT_BASE_URL = "http://localhost:11434";
const HEALTH_CHECK_TIMEOUT_MS = 3000;
class OllamaProvider {
    type = "ollama";
    baseUrl;
    defaultModel;
    constructor(baseUrl, defaultModel) {
        this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
        this.defaultModel = defaultModel || DEFAULT_MODEL;
    }
    async chat(messages, options) {
        const model = options?.model || this.defaultModel;
        const url = `${this.baseUrl}/api/chat`;
        const body = {
            model,
            messages: this.formatMessages(messages),
            stream: false,
        };
        if (options?.temperature !== undefined) {
            body.options = { temperature: options.temperature };
        }
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: options?.signal,
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new Error(`Ollama API error ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        return data.message?.content || "";
    }
    async *chatStream(messages, options) {
        const model = options?.model || this.defaultModel;
        const url = `${this.baseUrl}/api/chat`;
        const body = {
            model,
            messages: this.formatMessages(messages),
            stream: true,
        };
        if (options?.temperature !== undefined) {
            body.options = { temperature: options.temperature };
        }
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: options?.signal,
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new Error(`Ollama API error ${response.status}: ${errorText}`);
        }
        if (!response.body) {
            throw new Error("Ollama response has no body for streaming");
        }
        // Read NDJSON stream from response body
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Keep the last incomplete line in buffer
                buffer = lines.pop() || "";
                for (const line of lines) {
                    if (!line.trim()) {
                        continue;
                    }
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) {
                            yield parsed.message.content;
                        }
                    }
                    catch {
                        // Skip malformed JSON lines
                    }
                }
            }
            // Process remaining buffer
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer);
                    if (parsed.message?.content) {
                        yield parsed.message.content;
                    }
                }
                catch {
                    // Ignore trailing incomplete data
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    /**
     * Chat with tool calling support.
     * Ollama supports function calling via /api/chat with `tools` parameter.
     * Requires models that support tool calling (qwen2.5, llama3.1, mistral, etc.)
     */
    async chatWithTools(messages, tools, options) {
        const model = options?.model || this.defaultModel;
        const url = `${this.baseUrl}/api/chat`;
        // Convert tools to Ollama format
        const ollamaTools = tools.map((t) => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
            },
        }));
        const body = {
            model,
            messages: this.formatMessages(messages),
            tools: ollamaTools,
            stream: false,
        };
        if (options?.temperature !== undefined) {
            body.options = { temperature: options.temperature };
        }
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: options?.signal,
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new Error(`Ollama API error ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        const toolCalls = data.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
            // LLM wants to call tools
            const calls = toolCalls.map((tc, idx) => ({
                id: `ollama-tc-${Date.now()}-${idx}`,
                name: tc.function.name,
                arguments: tc.function.arguments,
            }));
            return { type: "tool_use", toolCalls: calls };
        }
        // LLM responded with text
        return { type: "text", text: data.message?.content || "" };
    }
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: "GET",
                signal: controller.signal,
            });
            clearTimeout(timeout);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    dispose() {
        // No persistent resources to clean up
    }
    /**
     * Format LlmMessage array to Ollama message format.
     * Handles tool result messages by converting them to assistant context.
     */
    formatMessages(messages) {
        return messages.map((m) => {
            if (m.role === "tool") {
                // Ollama expects tool results as messages with role "tool"
                return { role: "tool", content: m.content };
            }
            return { role: m.role, content: m.content };
        });
    }
}
exports.OllamaProvider = OllamaProvider;
//# sourceMappingURL=ollama-provider.js.map