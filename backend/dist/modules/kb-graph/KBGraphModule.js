/**
 * KB Graph Module — knowledge graph operations.
 */
import { SqliteGraphService } from './SqliteGraphService.js';
export class KBGraphModule {
    name = 'kbGraph';
    _status = 'initializing';
    logger;
    graphService;
    constructor(logger) {
        this.logger = logger.child({ module: this.name });
        this.graphService = new SqliteGraphService(this.logger);
    }
    get status() { return this._status; }
    async initialize() {
        this.logger.info('Initializing KB graph module');
        this.graphService.initialize();
        // Expose globally for admin routes spatial endpoint
        globalThis.__sqliteGraphService = this.graphService;
        this._status = 'ready';
    }
    async shutdown() {
        this._status = 'stopped';
    }
    getToolHandlers() {
        const handlers = new Map();
        handlers.set('kb_graph_query', async (args) => ({
            content: [{ type: 'text', text: JSON.stringify({ nodes: [], edges: [], query: args.query }) }],
            isError: false,
        }));
        handlers.set('kb_graph_add_node', async (args) => ({
            content: [{ type: 'text', text: `Node added: ${args.title}` }],
            isError: false,
        }));
        handlers.set('kb_graph_add_edge', async (args) => ({
            content: [{ type: 'text', text: `Edge added: ${args.from} -> ${args.to}` }],
            isError: false,
        }));
        return handlers;
    }
    getToolDefinitions() {
        return [
            { name: 'kb_graph_query', description: 'Query the knowledge base graph', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, category: 'kb-graph' },
            { name: 'kb_graph_add_node', description: 'Add a node to the KB graph', inputSchema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title'] }, category: 'kb-graph' },
            { name: 'kb_graph_add_edge', description: 'Add an edge between KB graph nodes', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, relation: { type: 'string' } }, required: ['from', 'to'] }, category: 'kb-graph' },
        ];
    }
}
//# sourceMappingURL=KBGraphModule.js.map