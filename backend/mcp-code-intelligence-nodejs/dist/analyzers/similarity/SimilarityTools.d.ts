/**
 * KSA-168: MCP Tool registrations for similarity & mining tools.
 */
import Database from 'better-sqlite3';
export declare const SIMILARITY_TOOL_DEFINITIONS: ({
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
            min_similarity: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            min_confidence?: undefined;
            query?: undefined;
            author?: undefined;
            file?: undefined;
            since?: undefined;
            force?: undefined;
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
            min_confidence: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            min_similarity?: undefined;
            query?: undefined;
            author?: undefined;
            file?: undefined;
            since?: undefined;
            force?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            author: {
                type: string;
                description: string;
            };
            file: {
                type: string;
                description: string;
            };
            since: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            file_path?: undefined;
            module?: undefined;
            min_similarity?: undefined;
            min_confidence?: undefined;
            force?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            force: {
                type: string;
                description: string;
            };
            file_path?: undefined;
            module?: undefined;
            min_similarity?: undefined;
            limit?: undefined;
            min_confidence?: undefined;
            query?: undefined;
            author?: undefined;
            file?: undefined;
            since?: undefined;
        };
        required?: undefined;
    };
})[];
/** Dispatch a similarity/mining tool call. */
export declare function handleSimilarityTool(name: string, args: Record<string, unknown>, db: Database.Database, workspacePath: string): string | null;
//# sourceMappingURL=SimilarityTools.d.ts.map