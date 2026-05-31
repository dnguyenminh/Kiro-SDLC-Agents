"use strict";
/**
 * KSA-157: MCP Tool Registration for code_traverse.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRAVERSE_TOOL_DEFINITIONS = void 0;
exports.handleCodeTraverse = handleCodeTraverse;
const symbol_resolver_js_1 = require("../graph/symbol-resolver.js");
const traverser_js_1 = require("../graph/traverser.js");
exports.TRAVERSE_TOOL_DEFINITIONS = [
    {
        name: 'code_traverse',
        description: 'Generic graph traversal with custom edge/node type filters. Traverse the code relationship graph from any symbol with fine-grained control.',
        inputSchema: {
            type: 'object',
            properties: {
                start: { type: 'string', description: 'Start symbol (e.g. "MyClass", "MyClass.method", "file.ts:func")' },
                edge_types: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter by edge types: calls, imports, inherits, implements, uses, decorates (default: all)',
                },
                node_types: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter by node types: function, class, interface, method, variable (default: all)',
                },
                direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], description: 'Traversal direction (default: outgoing)' },
                max_depth: { type: 'number', description: 'Maximum traversal depth 1-10 (default: 3)' },
                max_results: { type: 'number', description: 'Maximum results (default: 50)' },
                include_source: { type: 'boolean', description: 'Include source code snippets (default: false)' },
                source_lines: { type: 'number', description: 'Lines of source to include (default: 5)' },
            },
            required: ['start'],
        },
    },
];
function handleCodeTraverse(args, db, workspace) {
    const start = args.start;
    if (!start)
        return JSON.stringify({ error: 'Parameter "start" is required' });
    const edgeTypes = args.edge_types ?? [];
    const nodeTypes = args.node_types ?? [];
    const direction = args.direction ?? 'outgoing';
    const maxDepth = Math.min(Math.max(args.max_depth ?? 3, 1), 10);
    const maxResults = Math.min(args.max_results ?? 50, 200);
    const includeSource = args.include_source ?? false;
    const sourceLines = args.source_lines ?? 5;
    const resolver = new symbol_resolver_js_1.SymbolResolver(db);
    const traverser = new traverser_js_1.GraphTraverser(db, resolver, workspace);
    // Resolve start node
    const startNode = traverser.resolveNode(start);
    if (!startNode) {
        const suggestions = resolver.suggest(start);
        if (suggestions.length > 0) {
            return `Symbol "${start}" not found. Did you mean: ${suggestions.join(', ')}?`;
        }
        return `Symbol "${start}" not found in index.`;
    }
    const config = { edgeTypes, nodeTypes, direction, maxDepth, maxResults };
    const startTime = Date.now();
    const results = traverser.traverse(startNode, config);
    const executionTimeMs = Date.now() - startTime;
    if (results.length === 0) {
        return `No connected nodes found from "${start}" with the given filters (direction: ${direction}, edge_types: ${edgeTypes.length > 0 ? edgeTypes.join(',') : 'all'}, node_types: ${nodeTypes.length > 0 ? nodeTypes.join(',') : 'all'})`;
    }
    const response = traverser.formatResponse(startNode, results, includeSource, sourceLines, executionTimeMs);
    return JSON.stringify(response, null, 2);
}
//# sourceMappingURL=code-traverse.js.map