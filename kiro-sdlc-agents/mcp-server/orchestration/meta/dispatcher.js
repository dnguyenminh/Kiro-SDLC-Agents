"use strict";
/**
 * Meta-tool dispatcher — routes meta-tool calls to handlers.
 * Behavioral parity with Kotlin MetaToolDispatcher.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaToolDispatcher = exports.META_TOOL_DEFINITIONS = void 0;
const find_tools_js_1 = require("./find-tools.js");
const execute_dynamic_js_1 = require("./execute-dynamic.js");
const agent_log_js_1 = require("./agent-log.js");
const manage_auto_approve_js_1 = require("./manage-auto-approve.js");
exports.META_TOOL_DEFINITIONS = [
    {
        name: 'find_tools',
        description: 'Search for available tools by describing what you want to accomplish. Returns tool definitions with input schemas.',
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Natural language description or keyword to search for' } }, required: ['query'] },
    },
    {
        name: 'execute_dynamic_tool',
        description: 'Execute a tool on an upstream MCP server by exact tool name.',
        inputSchema: { type: 'object', properties: { tool_name: { type: 'string', description: 'Exact tool name to execute' }, arguments: { type: 'object', description: 'Arguments for the tool' } }, required: ['tool_name'] },
    },
    {
        name: 'toggle_tool',
        description: 'Enable or disable a specific tool or an entire server for the current session.',
        inputSchema: { type: 'object', properties: { tool_name: { type: 'string' }, server_name: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['enabled'] },
    },
    {
        name: 'reset_tools',
        description: 'Reset all tool/server toggle states to their default enabled state.',
        inputSchema: { type: 'object', properties: { server_name: { type: 'string' } } },
    },
    manage_auto_approve_js_1.MANAGE_AUTO_APPROVE_DEFINITION,
    {
        name: 'orchestration_status',
        description: 'Show orchestration status: servers, tools, metrics.',
        inputSchema: { type: 'object', properties: {} },
    },
    agent_log_js_1.AGENT_LOG_DEFINITION,
];
const META_TOOL_NAMES = new Set(exports.META_TOOL_DEFINITIONS.map((d) => d.name));
class MetaToolDispatcher {
    engine;
    constructor(engine) {
        this.engine = engine;
    }
    /** Dispatch a meta-tool call. Returns null if not a meta-tool. */
    async dispatch(toolName, args) {
        if (!META_TOOL_NAMES.has(toolName))
            return null;
        if (toolName === 'find_tools')
            return (0, find_tools_js_1.executeFindToolsAsync)(this.engine, args);
        if (toolName === 'execute_dynamic_tool')
            return (0, execute_dynamic_js_1.executeDynamic)(this.engine, args);
        if (toolName === 'toggle_tool')
            return this.handleToggle(args);
        if (toolName === 'reset_tools')
            return this.handleReset();
        if (toolName === 'manage_auto_approve')
            return (0, manage_auto_approve_js_1.executeManageAutoApprove)(args, this.engine.getWorkspace());
        if (toolName === 'orchestration_status')
            return this.handleStatus();
        if (toolName === 'agent_log')
            return (0, agent_log_js_1.executeAgentLog)(args, this.engine.getWorkspace());
        return JSON.stringify({ error: `Meta-tool '${toolName}' not implemented` });
    }
    getDefinitions() { return exports.META_TOOL_DEFINITIONS; }
    handleToggle(args) {
        const enabled = args.enabled ?? true;
        const toolName = args.tool_name;
        if (toolName) {
            this.engine.getRegistry().toggle(toolName, enabled);
            return JSON.stringify({ toggled: toolName, enabled });
        }
        return JSON.stringify({ error: 'tool_name or server_name required' });
    }
    handleReset() {
        this.engine.getRegistry().resetToggles();
        return JSON.stringify({ reset: true });
    }
    handleStatus() {
        return JSON.stringify({ orchestration: this.engine.getStatus(), servers: this.engine.getServerStatus() });
    }
}
exports.MetaToolDispatcher = MetaToolDispatcher;
//# sourceMappingURL=dispatcher.js.map