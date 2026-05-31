"use strict";
/**
 * KSA-163: MCP Tool registrations for graph analysis tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRAPH_ANALYSIS_TOOL_DEFINITIONS = void 0;
exports.handleGraphAnalysisTool = handleGraphAnalysisTool;
const GraphLoader_js_1 = require("./utils/GraphLoader.js");
const CircularDepDetector_js_1 = require("./CircularDepDetector.js");
const RelatedTestFinder_js_1 = require("./RelatedTestFinder.js");
const HotPathAnalyzer_js_1 = require("./HotPathAnalyzer.js");
const DeadImportDetector_js_1 = require("./DeadImportDetector.js");
const ModuleSummarizer_js_1 = require("./ModuleSummarizer.js");
exports.GRAPH_ANALYSIS_TOOL_DEFINITIONS = [
    {
        name: 'find_circular_deps',
        description: 'Find circular dependencies in the codebase using Tarjan\'s SCC algorithm.',
        inputSchema: {
            type: 'object',
            properties: {
                module: { type: 'string', description: 'Filter by module name' },
                max_length: { type: 'number', description: 'Max cycle length to report (default: unlimited)' },
            },
        },
    },
    {
        name: 'find_related_tests',
        description: 'Find test files/functions that test a given symbol (reverse BFS on call graph).',
        inputSchema: {
            type: 'object',
            properties: {
                symbol_name: { type: 'string', description: 'Symbol name to find tests for' },
                file_path: { type: 'string', description: 'File path to disambiguate symbol' },
                max_depth: { type: 'number', description: 'Max call chain depth (default: 3)' },
            },
            required: ['symbol_name'],
        },
    },
    {
        name: 'find_hot_paths',
        description: 'Find most-called functions (hot paths) by transitive caller count.',
        inputSchema: {
            type: 'object',
            properties: {
                module: { type: 'string', description: 'Filter by module name' },
                limit: { type: 'number', description: 'Max results (default: 20)' },
                min_callers: { type: 'number', description: 'Minimum direct callers threshold (default: 2)' },
            },
        },
    },
    {
        name: 'find_dead_imports',
        description: 'Find unused/dead imports in the codebase.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Filter by file path' },
                module: { type: 'string', description: 'Filter by module name' },
                limit: { type: 'number', description: 'Max results (default: 50)' },
            },
        },
    },
    {
        name: 'module_summary',
        description: 'Get quality summary for a module: circular deps, hot paths, dead imports, avg complexity.',
        inputSchema: {
            type: 'object',
            properties: {
                module: { type: 'string', description: 'Module name (omit for all modules)' },
            },
        },
    },
];
/** Dispatch a graph analysis tool call. */
function handleGraphAnalysisTool(name, args, db) {
    const graphLoader = new GraphLoader_js_1.GraphLoader(db);
    switch (name) {
        case 'find_circular_deps':
            return handleCircularDeps(args, graphLoader);
        case 'find_related_tests':
            return handleRelatedTests(args, graphLoader);
        case 'find_hot_paths':
            return handleHotPaths(args, graphLoader);
        case 'find_dead_imports':
            return handleDeadImports(args, db);
        case 'module_summary':
            return handleModuleSummary(args, db);
        default:
            return null;
    }
}
function handleCircularDeps(args, graphLoader) {
    const detector = new CircularDepDetector_js_1.CircularDepDetector(graphLoader);
    const results = detector.detect({
        module: args.module,
        maxLength: args.max_length,
    });
    if (results.length === 0)
        return 'No circular dependencies found.';
    const lines = [`Found ${results.length} circular dependencies:\n`];
    for (const dep of results) {
        lines.push(`[${dep.severity.toUpperCase()}] Cycle (length ${dep.length}):`);
        lines.push(`  ${dep.cycle.edges.join(' → ')}`);
        for (const node of dep.cycle.nodes) {
            lines.push(`    - ${node.name} (${node.kind}) — ${node.filePath}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function handleRelatedTests(args, graphLoader) {
    const symbolName = args.symbol_name;
    if (!symbolName)
        return 'Parameter "symbol_name" is required.';
    const finder = new RelatedTestFinder_js_1.RelatedTestFinder(graphLoader);
    const result = finder.find(symbolName, {
        maxDepth: args.max_depth,
        filePath: args.file_path,
    });
    if (!result)
        return `Symbol "${symbolName}" not found in index.`;
    if (result.totalTests === 0)
        return `No tests found for "${symbolName}".`;
    const lines = [
        `Tests for ${result.symbol.name} (${result.symbol.filePath}):\n`,
        `Direct tests (${result.directTests.length}):`,
    ];
    for (const t of result.directTests) {
        lines.push(`  ✓ ${t.testName} — ${t.filePath}`);
    }
    if (result.indirectTests.length > 0) {
        lines.push(`\nIndirect tests (${result.indirectTests.length}):`);
        for (const t of result.indirectTests) {
            lines.push(`  ○ ${t.testName} — ${t.filePath} (depth: ${t.depth})`);
            lines.push(`    Chain: ${t.path.join(' → ')}`);
        }
    }
    return lines.join('\n');
}
function handleHotPaths(args, graphLoader) {
    const analyzer = new HotPathAnalyzer_js_1.HotPathAnalyzer(graphLoader);
    const results = analyzer.analyze({
        module: args.module,
        limit: args.limit,
        minCallers: args.min_callers,
    });
    if (results.length === 0)
        return 'No hot paths found (no functions with multiple callers).';
    const lines = [`Hot Paths — Top ${results.length} most-called functions:\n`];
    for (let i = 0; i < results.length; i++) {
        const hp = results[i];
        lines.push(`${i + 1}. ${hp.symbolName} (${hp.kind}) — ` +
            `${hp.directCallers} direct, ${hp.transitiveCallers} transitive callers`);
        lines.push(`   ${hp.filePath}`);
    }
    return lines.join('\n');
}
function handleDeadImports(args, db) {
    const detector = new DeadImportDetector_js_1.DeadImportDetector(db);
    const results = detector.detect({
        filePath: args.file_path,
        module: args.module,
        limit: args.limit,
    });
    if (results.length === 0)
        return 'No dead imports found.';
    const lines = [`Found ${results.length} potentially unused imports:\n`];
    for (const imp of results) {
        lines.push(`  ${imp.filePath}:${imp.line} — ${imp.importedSymbol}${imp.fromModule ? ` from "${imp.fromModule}"` : ''}`);
    }
    return lines.join('\n');
}
function handleModuleSummary(args, db) {
    const summarizer = new ModuleSummarizer_js_1.ModuleSummarizer(db);
    const results = summarizer.summarize(args.module);
    if (results.length === 0)
        return 'No modules found.';
    const lines = [`Module Quality Summary (${results.length} modules):\n`];
    for (const mod of results) {
        lines.push(`📦 ${mod.module}`);
        lines.push(`   Files: ${mod.fileCount} | Symbols: ${mod.symbolCount}`);
        lines.push(`   Circular Deps: ${mod.circularDeps} | Dead Imports: ${mod.deadImports}`);
        lines.push(`   Avg Complexity: ${mod.avgComplexity?.toFixed(1) ?? 'N/A'}`);
        if (mod.hotPaths.length > 0) {
            lines.push(`   Hot Paths: ${mod.hotPaths.map(h => h.symbolName).join(', ')}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=GraphAnalysisTools.js.map