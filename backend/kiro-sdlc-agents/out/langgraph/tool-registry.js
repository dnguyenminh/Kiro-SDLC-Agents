"use strict";
/**
 * ToolRegistry — Fetches ALL tools from MCP server and caches them.
 * Provides tool definitions in LLM-compatible formats (Anthropic, OpenAI, Ollama).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
class ToolRegistry {
    mcpBridge;
    tools = null;
    constructor(mcpBridge) {
        this.mcpBridge = mcpBridge;
    }
    /**
     * Fetch all tools from MCP via tools/list. Caches result until invalidated.
     * Returns empty array if MCP is unavailable.
     */
    async getTools() {
        if (this.tools !== null) {
            return this.tools;
        }
        if (!this.mcpBridge.isAvailable()) {
            return [];
        }
        try {
            const tools = await this.mcpBridge.listTools();
            this.tools = tools;
            return tools;
        }
        catch {
            // MCP unavailable or tools/list failed — return empty
            return [];
        }
    }
    /** Convert cached tools to Anthropic tool_use format */
    toAnthropicFormat(tools) {
        return tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
        }));
    }
    /** Convert cached tools to OpenAI/Ollama function calling format */
    toOpenAIFormat(tools) {
        return tools.map((t) => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
            },
        }));
    }
    /** Invalidate cache — call on MCP reconnect or tool changes */
    invalidate() {
        this.tools = null;
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=tool-registry.js.map