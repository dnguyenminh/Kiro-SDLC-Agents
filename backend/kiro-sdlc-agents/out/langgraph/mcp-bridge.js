"use strict";
/**
 * McpBridge — KSA-210
 * Wraps McpServerManager for use by LangGraph nodes.
 * Provides timeout-aware tool invocation and availability checks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpToolTimeoutError = exports.McpBridge = void 0;
const types_1 = require("../types");
/** Default tool call timeout (60s per TDD Section 3.3) */
const DEFAULT_TOOL_TIMEOUT_MS = 60_000;
/** Timeout for tools/list request */
const LIST_TOOLS_TIMEOUT_MS = 10_000;
class McpBridge {
    mcpManager;
    constructor(mcpManager) {
        this.mcpManager = mcpManager;
    }
    /**
     * Invoke an MCP tool with timeout protection.
     * Delegates to McpServerManager.invokeTool().
     */
    async callTool(name, args, timeoutMs = DEFAULT_TOOL_TIMEOUT_MS) {
        if (!this.isAvailable()) {
            throw new types_1.McpServerNotRunningError();
        }
        // Race the tool call against a timeout
        const timeoutPromise = new Promise((_, reject) => {
            const timer = setTimeout(() => {
                reject(new McpToolTimeoutError(name, timeoutMs));
            }, timeoutMs);
            timer.unref?.();
        });
        return Promise.race([
            this.mcpManager.invokeTool(name, args),
            timeoutPromise,
        ]);
    }
    /**
     * Fetch all available tools from MCP server via tools/list.
     * Returns array of tool definitions with name, description, and inputSchema.
     */
    async listTools() {
        if (!this.isAvailable()) {
            throw new types_1.McpServerNotRunningError();
        }
        const port = this.mcpManager.port;
        if (!port) {
            throw new types_1.McpServerNotRunningError();
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), LIST_TOOLS_TIMEOUT_MS);
        try {
            const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: Date.now(),
                    method: "tools/list",
                    params: {},
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = (await response.json());
            if (data.error) {
                throw new Error(`MCP error (${data.error.code}): ${data.error.message}`);
            }
            return data.result?.tools ?? [];
        }
        catch (err) {
            clearTimeout(timeout);
            if (err.name === "AbortError") {
                throw new McpToolTimeoutError("tools/list", LIST_TOOLS_TIMEOUT_MS);
            }
            throw err;
        }
    }
    /**
     * Check if MCP server is running and available for tool calls.
     */
    isAvailable() {
        return this.mcpManager.status === "running";
    }
}
exports.McpBridge = McpBridge;
/**
 * Error thrown when an MCP tool call exceeds its timeout.
 */
class McpToolTimeoutError extends Error {
    constructor(toolName, timeoutMs) {
        super(`MCP tool '${toolName}' timed out after ${timeoutMs}ms`);
        this.name = "McpToolTimeoutError";
    }
}
exports.McpToolTimeoutError = McpToolTimeoutError;
//# sourceMappingURL=mcp-bridge.js.map