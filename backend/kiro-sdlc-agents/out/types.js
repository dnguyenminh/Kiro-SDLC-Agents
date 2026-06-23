"use strict";
/**
 * Shared TypeScript interfaces and types for Kiro SDLC Agents v2.0.0.
 * Defines contracts for MCP server communication, webview messaging, and panel management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_CONSTANTS = exports.NODE_TYPE_COLORS = exports.PANEL_TITLES = exports.PANEL_VIEW_TYPES = exports.McpBundleMissingError = exports.McpSpawnError = exports.McpTimeoutError = exports.McpServerNotRunningError = void 0;
// === Error Types ===
class McpServerNotRunningError extends Error {
    constructor() {
        super("MCP Server is not running.");
        this.name = "McpServerNotRunningError";
    }
}
exports.McpServerNotRunningError = McpServerNotRunningError;
class McpTimeoutError extends Error {
    constructor(toolName, timeoutMs) {
        super(`MCP tool '${toolName}' timed out after ${timeoutMs}ms.`);
        this.name = "McpTimeoutError";
    }
}
exports.McpTimeoutError = McpTimeoutError;
class McpSpawnError extends Error {
    constructor(reason) {
        super(`MCP server failed to start: ${reason}`);
        this.name = "McpSpawnError";
    }
}
exports.McpSpawnError = McpSpawnError;
class McpBundleMissingError extends Error {
    constructor() {
        super("MCP server bundle not found. Reinstall extension.");
        this.name = "McpBundleMissingError";
    }
}
exports.McpBundleMissingError = McpBundleMissingError;
// === Constants ===
exports.PANEL_VIEW_TYPES = {
    graph: "kiroKbGraph",
    dashboard: "kiroKbDashboard",
    tags: "kiroKbTags",
    quality: "kiroKbQuality",
    analytics: "kiroKbAnalytics",
    workflow: "kiroWorkflowGraph",
};
exports.PANEL_TITLES = {
    graph: "KB Graph",
    dashboard: "KB Dashboard",
    tags: "KB Tags",
    quality: "KB Quality",
    analytics: "KB Analytics",
    workflow: "SDLC Workflow Graph",
};
exports.NODE_TYPE_COLORS = {
    DECISION: "#3b82f6",
    ERROR_PATTERN: "#ef4444",
    ARCHITECTURE: "#8b5cf6",
    API_DESIGN: "#14b8a6",
    REQUIREMENT: "#ec4899",
    LESSON_LEARNED: "#06b6d4",
    PROCEDURE: "#10b981",
    CONTEXT: "#f59e0b",
    CODE_ENTITY: "#6366f1",
};
exports.SERVER_CONSTANTS = {
    DEFAULT_PORT: 9180,
    MAX_RESTARTS: 3,
    BACKOFF_MS: [5000, 15000, 30000],
    STARTUP_TIMEOUT_MS: 5000,
    REQUEST_TIMEOUT_MS: 30000,
    KILL_TIMEOUT_MS: 5000,
    DASHBOARD_REFRESH_MS: 60000,
    /** Fallback polling interval for event-driven panels (5 min safety net). */
    PANEL_FALLBACK_REFRESH_MS: 300000,
    GRAPH_MAX_NODES: 500,
};
//# sourceMappingURL=types.js.map