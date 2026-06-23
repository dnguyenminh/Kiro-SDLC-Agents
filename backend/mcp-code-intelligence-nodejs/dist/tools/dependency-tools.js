"use strict";
/**
 * KSA-155: MCP Tool Registration for code_dependencies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPENDENCY_TOOL_DEFINITIONS = void 0;
exports.handleCodeDependencies = handleCodeDependencies;
const file_resolver_js_1 = require("../graph/file-resolver.js");
const dependency_graph_service_js_1 = require("../graph/dependency-graph-service.js");
const dependency_formatters_js_1 = require("../graph/dependency-formatters.js");
exports.DEPENDENCY_TOOL_DEFINITIONS = [
    {
        name: 'code_dependencies',
        description: 'Analyze file/module import dependencies with direction and depth control. Shows what a file imports (outgoing) or what imports it (incoming).',
        inputSchema: {
            type: 'object',
            properties: {
                file: { type: 'string', description: 'File path to analyze (relative or absolute)' },
                direction: { type: 'string', enum: ['incoming', 'outgoing', 'both'], description: 'Direction of dependency analysis (default: outgoing)' },
                depth: { type: 'number', description: 'Traversal depth 1-5 (default: 1)' },
                include_external: { type: 'boolean', description: 'Include external/stdlib dependencies (default: false)' },
                format: { type: 'string', enum: ['tree', 'flat', 'graph'], description: 'Output format (default: tree)' },
                limit: { type: 'number', description: 'Max results (default: 50)' },
            },
            required: ['file'],
        },
    },
];
function handleCodeDependencies(args, db, workspace) {
    const file = args.file;
    if (!file)
        return JSON.stringify({ error: 'Parameter "file" is required' });
    const direction = args.direction ?? 'outgoing';
    const depth = args.depth ?? 1;
    const includeExternal = args.include_external ?? false;
    const format = args.format ?? 'tree';
    const limit = args.limit ?? 50;
    const fileResolver = new file_resolver_js_1.FileResolver(db, workspace);
    const service = new dependency_graph_service_js_1.DependencyGraphService(db, fileResolver);
    const result = service.query(file, direction, depth, includeExternal, limit);
    if (result.results.length === 0 && result.root === file) {
        return `File "${file}" not found in index. Make sure the file has been indexed.`;
    }
    if (result.results.length === 0) {
        return `No ${direction} dependencies found for "${result.root}"`;
    }
    const formatted = (0, dependency_formatters_js_1.formatDependencyResult)(result, format);
    return JSON.stringify(formatted, null, 2);
}
//# sourceMappingURL=dependency-tools.js.map