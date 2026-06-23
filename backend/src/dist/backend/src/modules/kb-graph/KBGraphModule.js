/**
 * KBGraphModule — handles knowledge base graph operations.
 * Implements TDD §5.2 modules/kb-graph/KBGraphModule.ts.
 */
const KB_GRAPH_TOOLS = [
// KB Graph data is served via /api/kb/graph endpoints
// No direct MCP tool mapping for this module
];
export class KBGraphModule {
    name = 'kbGraph';
    _status = 'initializing';
    get status() {
        return this._status;
    }
    async initialize() {
        console.log('[KBGraphModule] Initializing...');
        this._status = 'ready';
        console.log('[KBGraphModule] Ready');
    }
    async shutdown() {
        this._status = 'initializing';
        console.log('[KBGraphModule] Shut down');
    }
    getToolHandlers() {
        return new Map();
    }
    getToolDefinitions() {
        return KB_GRAPH_TOOLS;
    }
}
//# sourceMappingURL=KBGraphModule.js.map