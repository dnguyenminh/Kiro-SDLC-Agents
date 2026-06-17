/**
 * ToolDefinitions — central registry of all tool schemas.
 * Loaded from tool-list.txt or defined inline for standalone mode.
 */
/**
 * Get all built-in tool definitions.
 * In production, this would load from .code-intel/tool-list.txt.
 * For now, module-level definitions are used.
 */
export function getBuiltinToolDefinitions() {
    // Tools are defined in each module's getToolDefinitions()
    // This file serves as an optional central override/aggregation point
    return [];
}
//# sourceMappingURL=ToolDefinitions.js.map