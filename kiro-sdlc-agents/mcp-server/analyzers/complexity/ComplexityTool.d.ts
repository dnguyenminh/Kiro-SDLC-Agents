/**
 * KSA-161: MCP Tool registration for complexity_analysis.
 */
import Database from 'better-sqlite3';
export declare const COMPLEXITY_TOOL_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file_path: {
                type: string;
                description: string;
            };
            symbol_name: {
                type: string;
                description: string;
            };
            min_complexity: {
                type: string;
                description: string;
            };
            grade_filter: {
                type: string;
                description: string;
            };
            module: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            sort_by: {
                type: string;
                description: string;
            };
        };
    };
};
/** Handle complexity_analysis tool call. */
export declare function handleComplexityTool(args: Record<string, unknown>, db: Database.Database): string;
/** Register the complexity tool in the dispatch system. */
export declare function registerComplexityTool(): typeof COMPLEXITY_TOOL_DEFINITION;
//# sourceMappingURL=ComplexityTool.d.ts.map