/**
 * KSA-163: MCP Tool registrations for graph analysis tools.
 */
import Database from 'better-sqlite3';
export declare const GRAPH_ANALYSIS_TOOL_DEFINITIONS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            module: {
                type: string;
                description: string;
            };
            max_length: {
                type: string;
                description: string;
            };
            symbol_name?: undefined;
            file_path?: undefined;
            max_depth?: undefined;
            limit?: undefined;
            min_callers?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol_name: {
                type: string;
                description: string;
            };
            file_path: {
                type: string;
                description: string;
            };
            max_depth: {
                type: string;
                description: string;
            };
            module?: undefined;
            max_length?: undefined;
            limit?: undefined;
            min_callers?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            module: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            min_callers: {
                type: string;
                description: string;
            };
            max_length?: undefined;
            symbol_name?: undefined;
            file_path?: undefined;
            max_depth?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file_path: {
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
            max_length?: undefined;
            symbol_name?: undefined;
            max_depth?: undefined;
            min_callers?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            module: {
                type: string;
                description: string;
            };
            max_length?: undefined;
            symbol_name?: undefined;
            file_path?: undefined;
            max_depth?: undefined;
            limit?: undefined;
            min_callers?: undefined;
        };
        required?: undefined;
    };
})[];
/** Dispatch a graph analysis tool call. */
export declare function handleGraphAnalysisTool(name: string, args: Record<string, unknown>, db: Database.Database): string | null;
