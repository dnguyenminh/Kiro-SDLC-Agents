/**
 * KSA-157: MCP Tool Registration for code_traverse.
 */
import Database from 'better-sqlite3';
export declare const TRAVERSE_TOOL_DEFINITIONS: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            start: {
                type: string;
                description: string;
            };
            edge_types: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            node_types: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            direction: {
                type: string;
                enum: string[];
                description: string;
            };
            max_depth: {
                type: string;
                description: string;
            };
            max_results: {
                type: string;
                description: string;
            };
            include_source: {
                type: string;
                description: string;
            };
            source_lines: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
}[];
export declare function handleCodeTraverse(args: Record<string, unknown>, db: Database.Database, workspace: string): string;
