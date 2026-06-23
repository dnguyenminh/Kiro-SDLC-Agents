"use strict";
/**
 * HookEventsManager — KSA-249
 * Central event dispatcher with circular dependency detection.
 * Matches hooks by event type and tool category, fires them via HookExecutor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookEventsManager = void 0;
const hook_loader_1 = require("./hook-loader");
const hook_executor_1 = require("./hook-executor");
/** Tool category classification map */
const TOOL_CATEGORIES = {
    readFile: "read",
    read_file: "read",
    read_code: "read",
    read_files: "read",
    grep_search: "read",
    file_search: "read",
    list_directory: "read",
    get_diagnostics: "spec",
    get_process_output: "spec",
    fs_write: "write",
    str_replace: "write",
    fs_append: "write",
    delete_file: "write",
    execute_pwsh: "shell",
    control_pwsh_process: "shell",
    web_search: "web",
    fetch_url: "web",
};
class HookEventsManager {
    executionStack = new Set();
    executionLog = [];
    maxDepth;
    executor;
    workspaceRoot;
    outputChannel;
    constructor(workspaceRoot, outputChannel, maxDepth = 3) {
        this.workspaceRoot = workspaceRoot;
        this.outputChannel = outputChannel;
        this.maxDepth = maxDepth;
        this.executor = new hook_executor_1.HookExecutor(outputChannel);
    }
    /**
     * Fire event for a given type. Finds matching hooks and executes them.
     */
    async fireEvent(eventType, context) {
        const hooks = await (0, hook_loader_1.loadHooks)(this.workspaceRoot);
        const matching = (0, hook_loader_1.filterHooksByType)(hooks, eventType);
        for (const hook of matching) {
            if (this.isCircular(hook.name)) {
                this.outputChannel.appendLine(`[WARN] Circular hook skipped: "${hook.name}"`);
                continue;
            }
            await this.executeHook(hook, context);
        }
    }
    /**
     * Fire preToolUse event. Returns denial info if any hook denies the tool call.
     */
    async firePreToolUse(toolName, args) {
        const hooks = await (0, hook_loader_1.loadHooks)(this.workspaceRoot);
        const category = this.classifyTool(toolName);
        const matching = this.getMatchingToolHooks(hooks, "preToolUse", toolName, category);
        const context = { toolName, toolArgs: args };
        for (const hook of matching) {
            if (this.isCircular(hook.name)) {
                this.outputChannel.appendLine(`[WARN] Circular preToolUse skipped: "${hook.name}"`);
                continue;
            }
            const result = await this.executeHook(hook, context);
            if (result.status === "denied") {
                return { denied: true, hookName: hook.name, reason: result.error };
            }
        }
        return { denied: false };
    }
    /**
     * Fire postToolUse event. Matches by tool category and regex patterns.
     */
    async firePostToolUse(toolName, args, result) {
        const hooks = await (0, hook_loader_1.loadHooks)(this.workspaceRoot);
        const category = this.classifyTool(toolName);
        const matching = this.getMatchingToolHooks(hooks, "postToolUse", toolName, category);
        const context = { toolName, toolArgs: args, toolResult: result };
        for (const hook of matching) {
            if (this.isCircular(hook.name))
                continue;
            await this.executeHook(hook, context);
        }
    }
    /**
     * Execute a single hook with circular detection tracking.
     */
    async executeHook(hook, context) {
        this.executionStack.add(hook.name);
        const result = await this.executor.execute(hook, context);
        this.executionStack.delete(hook.name);
        this.executionLog.push({
            hookName: hook.name,
            eventType: hook.when.type,
            timestamp: Date.now(),
            result: result.status,
            duration: result.duration,
        });
        if (this.executionLog.length > 200) {
            this.executionLog = this.executionLog.slice(-100);
        }
        return result;
    }
    /**
     * Check if executing this hook would create a circular dependency.
     */
    isCircular(hookName) {
        if (this.executionStack.has(hookName))
            return true;
        return this.executionStack.size >= this.maxDepth;
    }
    /**
     * Classify a tool name into a category.
     */
    classifyTool(toolName) {
        return TOOL_CATEGORIES[toolName] || "other";
    }
    /**
     * Get hooks matching a tool event type (pre/post) and tool name/category.
     */
    getMatchingToolHooks(hooks, eventType, toolName, category) {
        return hooks.filter(h => {
            if (h.when.type !== eventType)
                return false;
            return this.matchesToolType(h, toolName, category);
        });
    }
    /**
     * Check if a hook's toolTypes match the given tool name or category.
     * Supports: exact category, "*" wildcard, regex patterns.
     */
    matchesToolType(hook, toolName, category) {
        const toolTypes = hook.when.toolTypes;
        if (!toolTypes || toolTypes.length === 0)
            return true;
        return toolTypes.some(pattern => {
            if (pattern === "*")
                return true;
            if (pattern === category)
                return true;
            if (pattern === toolName)
                return true;
            try {
                return new RegExp(pattern).test(toolName);
            }
            catch {
                return false;
            }
        });
    }
    /** Get recent execution log entries. */
    getExecutionLog(limit = 50) {
        return this.executionLog.slice(-limit);
    }
}
exports.HookEventsManager = HookEventsManager;
//# sourceMappingURL=hook-events.js.map