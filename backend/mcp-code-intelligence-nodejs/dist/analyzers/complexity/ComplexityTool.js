"use strict";
/**
 * KSA-161: MCP Tool registration for complexity_analysis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLEXITY_TOOL_DEFINITION = void 0;
exports.handleComplexityTool = handleComplexityTool;
exports.registerComplexityTool = registerComplexityTool;
const ComplexityAnalyzer_js_1 = require("./ComplexityAnalyzer.js");
exports.COMPLEXITY_TOOL_DEFINITION = {
    name: 'complexity_analysis',
    description: 'Analyze cyclomatic complexity of functions with breakdown and A-F grading. Query by file, symbol, grade, or module.',
    inputSchema: {
        type: 'object',
        properties: {
            file_path: { type: 'string', description: 'Filter by file path (partial match)' },
            symbol_name: { type: 'string', description: 'Filter by function/method name' },
            min_complexity: { type: 'number', description: 'Minimum CC threshold (default: 1)' },
            grade_filter: { type: 'string', description: 'Comma-separated grades to include (e.g. "C,D,F")' },
            module: { type: 'string', description: 'Filter by module name' },
            limit: { type: 'number', description: 'Max results (default: 20)' },
            sort_by: { type: 'string', description: 'Sort by: complexity (default), name, file' },
        },
    },
};
/** Handle complexity_analysis tool call. */
function handleComplexityTool(args, db) {
    const analyzer = new ComplexityAnalyzer_js_1.ComplexityAnalyzer(db);
    const filters = {
        filePath: args.file_path,
        symbolName: args.symbol_name,
        minComplexity: args.min_complexity,
        gradeFilter: args.grade_filter
            ? args.grade_filter.split(',').map(g => g.trim())
            : undefined,
        module: args.module,
        limit: args.limit ?? 20,
        sortBy: args.sort_by ?? 'complexity',
    };
    const result = analyzer.query(filters);
    if (result.results.length === 0) {
        return 'No complexity data found. Run indexing first to compute complexity metrics.';
    }
    const lines = [
        `Complexity Analysis — ${result.total} functions found\n`,
        `Average CC: ${result.summary.average.toFixed(1)} | Grade Distribution: ` +
            `A=${result.summary.gradeDistribution.A} B=${result.summary.gradeDistribution.B} ` +
            `C=${result.summary.gradeDistribution.C} D=${result.summary.gradeDistribution.D} ` +
            `F=${result.summary.gradeDistribution.F}\n`,
    ];
    for (const r of result.results) {
        lines.push(`[${r.grade}] ${r.symbol_name} — CC=${r.cyclomatic_complexity} ` +
            `(branches=${r.branches} loops=${r.loops} logic=${r.logical_ops} ` +
            `exceptions=${r.exception_handlers} depth=${r.nesting_depth})`);
        lines.push(`    ${r.file_path}:${r.start_line}-${r.end_line}`);
    }
    return lines.join('\n');
}
/** Register the complexity tool in the dispatch system. */
function registerComplexityTool() {
    return exports.COMPLEXITY_TOOL_DEFINITION;
}
//# sourceMappingURL=ComplexityTool.js.map