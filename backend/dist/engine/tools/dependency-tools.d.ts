/**
 * KSA-155: MCP Tool Registration for code_dependencies.
 */
import Database from 'better-sqlite3';
export declare const DEPENDENCY_TOOL_DEFINITIONS: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file: {
                type: string;
                description: string;
            };
            direction: {
                type: string;
                enum: string[];
                description: string;
            };
            depth: {
                type: string;
                description: string;
            };
            include_external: {
                type: string;
                description: string;
            };
            format: {
                type: string;
                enum: string[];
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
}[];
export declare function handleCodeDependencies(args: Record<string, unknown>, db: Database.Database, workspace: string): string;
