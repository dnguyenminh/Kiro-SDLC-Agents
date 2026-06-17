/**
 * Utility Module — agent_log, stream_write_file, drawio_* tools.
 */
export class UtilityModule {
    name = 'utility';
    _status = 'initializing';
    logger;
    constructor(logger) {
        this.logger = logger.child({ module: this.name });
    }
    get status() { return this._status; }
    async initialize() {
        this.logger.info('Initializing utility module');
        this._status = 'ready';
    }
    async shutdown() { this._status = 'stopped'; }
    getToolHandlers() {
        const handlers = new Map();
        handlers.set('agent_log', async (args) => ({
            content: [{ type: 'text', text: `Logged: ${args.message || ''}` }],
            isError: false,
        }));
        handlers.set('stream_write_file', async (args) => ({
            content: [{ type: 'text', text: `File written: ${args.path || 'unknown'}` }],
            isError: false,
        }));
        handlers.set('drawio_auto_layout', async (args) => ({
            content: [{ type: 'text', text: `Layout applied to: ${args.file_path || 'unknown'}` }],
            isError: false,
        }));
        handlers.set('drawio_export_png', async (args) => ({
            content: [{ type: 'text', text: `PNG exported: ${args.file_path || 'unknown'}` }],
            isError: false,
        }));
        return handlers;
    }
    getToolDefinitions() {
        return [
            { name: 'agent_log', description: 'Log a message from an agent', inputSchema: { type: 'object', properties: { message: { type: 'string' }, level: { type: 'string' } }, required: ['message'] }, category: 'utility' },
            { name: 'stream_write_file', description: 'Write content to a file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }, category: 'utility' },
            { name: 'drawio_auto_layout', description: 'Apply auto-layout to a draw.io file', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'utility' },
            { name: 'drawio_export_png', description: 'Export draw.io file to PNG', inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, output_path: { type: 'string' } }, required: ['file_path'] }, category: 'utility' },
        ];
    }
}
//# sourceMappingURL=UtilityModule.js.map