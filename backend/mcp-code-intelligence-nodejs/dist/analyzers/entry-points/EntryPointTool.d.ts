/**
 * KSA-162: MCP Tool registration for find_entry_points.
 */
import Database from 'better-sqlite3';
export declare const ENTRY_POINT_TOOL_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            entry_type: {
                type: string;
                description: string;
            };
            framework: {
                type: string;
                description: string;
            };
            http_method: {
                type: string;
                description: string;
            };
            route_pattern: {
                type: string;
                description: string;
            };
            has_auth: {
                type: string;
                description: string;
            };
            file_path: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
        };
    };
};
/** Handle find_entry_points tool call. */
export declare function handleEntryPointTool(args: Record<string, unknown>, db: Database.Database): string;
//# sourceMappingURL=EntryPointTool.d.ts.map