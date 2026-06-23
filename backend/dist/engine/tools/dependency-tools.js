/**
 * KSA-155: MCP Tool Registration for code_dependencies.
 */
import { FileResolver } from '../graph/file-resolver.js';
import { DependencyGraphService } from '../graph/dependency-graph-service.js';
import { formatDependencyResult } from '../graph/dependency-formatters.js';
export const DEPENDENCY_TOOL_DEFINITIONS = [
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
export function handleCodeDependencies(args, db, workspace) {
    const file = args.file;
    if (!file)
        return JSON.stringify({ error: 'Parameter "file" is required' });
    const direction = args.direction ?? 'outgoing';
    const depth = args.depth ?? 1;
    const includeExternal = args.include_external ?? false;
    const format = args.format ?? 'tree';
    const limit = args.limit ?? 50;
    const fileResolver = new FileResolver(db, workspace);
    const service = new DependencyGraphService(db, fileResolver);
    const result = service.query(file, direction, depth, includeExternal, limit);
    if (result.results.length === 0 && result.root === file) {
        return `File "${file}" not found in index. Make sure the file has been indexed.`;
    }
    if (result.results.length === 0) {
        return `No ${direction} dependencies found for "${result.root}"`;
    }
    const formatted = formatDependencyResult(result, format);
    return JSON.stringify(formatted, null, 2);
}
//# sourceMappingURL=dependency-tools.js.map