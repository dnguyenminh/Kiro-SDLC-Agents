/**
 * UtilityModule — handles agent_log, stream_write_file, drawio_* tools.
 * Implements TDD §5.2 modules/utility/UtilityModule.ts.
 */
const UTILITY_TOOLS = [
    { name: 'agent_log', description: 'Log agent activity', inputSchema: { type: 'object', properties: { message: { type: 'string' }, level: { type: 'string' } }, required: ['message'] }, category: 'utility' },
    { name: 'stream_write_file', description: 'Write file content', inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] }, category: 'utility' },
    { name: 'drawio_auto_layout', description: 'Auto-layout a draw.io diagram', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'utility' },
    { name: 'drawio_export_png', description: 'Export draw.io diagram to PNG', inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, output_path: { type: 'string' } }, required: ['file_path'] }, category: 'utility' },
];
export class UtilityModule {
    name = 'utility';
    _status = 'initializing';
    get status() {
        return this._status;
    }
    async initialize() {
        console.log('[UtilityModule] Initializing...');
        this._status = 'ready';
        console.log('[UtilityModule] Ready');
    }
    async shutdown() {
        this._status = 'initializing';
        console.log('[UtilityModule] Shut down');
    }
    getToolHandlers() {
        const handlers = new Map();
        for (const tool of UTILITY_TOOLS) {
            handlers.set(tool.name, this.createHandler(tool.name));
        }
        return handlers;
    }
    getToolDefinitions() {
        return UTILITY_TOOLS;
    }
    createHandler(toolName) {
        return async (args) => {
            return {
                content: [{ type: 'text', text: '[' + toolName + '] executed with args: ' + JSON.stringify(args) }],
                isError: false,
            };
        };
    }
}
//# sourceMappingURL=UtilityModule.js.map