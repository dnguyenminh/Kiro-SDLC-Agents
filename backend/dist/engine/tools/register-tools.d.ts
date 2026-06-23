/**
 * Tool registration and dispatch for Code Intelligence and Graph Analysis.
 */
import { DatabaseManager } from '../db/database-manager.js';
import { IndexingEngine } from '../indexer/indexing-engine.js';
export declare const CODE_INTEL_TOOL_DEFINITIONS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file_path: {
                type: string;
                description: string;
            };
            algorithm: {
                type: string;
                description: string;
            };
            spacing: {
                type: string;
                description: string;
            };
            direction: {
                type: string;
                description: string;
            };
            export_png: {
                type: string;
                description: string;
            };
            force: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol: {
                type: string;
                description: string;
            };
            depth: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            file_filter: {
                type: string;
                description: string;
            };
            kind_filter: {
                type: string;
                description: string;
            };
            include_external?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol: {
                type: string;
                description: string;
            };
            depth: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            file_filter: {
                type: string;
                description: string;
            };
            include_external: {
                type: string;
                description: string;
            };
            kind_filter?: undefined;
        };
        required: string[];
    };
} | {
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
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol: {
                type: string;
                description: string;
            };
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            depth: {
                type: string;
                description: string;
            };
            include_tests: {
                type: string;
                description: string;
            };
            severity_threshold: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: string[];
    };
} | {
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
} | {
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
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol: {
                type: string;
                description: string;
            };
            intent: {
                type: string;
                description: string;
                enum: string[];
            };
            token_budget: {
                type: string;
                description: string;
            };
            caller_depth: {
                type: string;
                description: string;
            };
            include_callers?: undefined;
            include_tests?: undefined;
            include_git?: undefined;
            query?: undefined;
            max_tokens?: undefined;
            include_source?: undefined;
            include_memory?: undefined;
            include_graph?: undefined;
            source_weights?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol: {
                type: string;
                description: string;
            };
            include_callers: {
                type: string;
                description: string;
            };
            include_tests: {
                type: string;
                description: string;
            };
            include_git: {
                type: string;
                description: string;
            };
            token_budget: {
                type: string;
                description: string;
            };
            caller_depth: {
                type: string;
                description: string;
            };
            intent?: undefined;
            query?: undefined;
            max_tokens?: undefined;
            include_source?: undefined;
            include_memory?: undefined;
            include_graph?: undefined;
            source_weights?: undefined;
        };
        required: string[];
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
            max_tokens: {
                type: string;
                description: string;
            };
            include_source: {
                type: string;
                description: string;
            };
            include_memory: {
                type: string;
                description: string;
            };
            include_graph: {
                type: string;
                description: string;
            };
            source_weights: {
                type: string;
                description: string;
                properties: {
                    code: {
                        type: string;
                    };
                    memory: {
                        type: string;
                    };
                    graph: {
                        type: string;
                    };
                };
            };
            symbol?: undefined;
            intent?: undefined;
            token_budget?: undefined;
            caller_depth?: undefined;
            include_callers?: undefined;
            include_tests?: undefined;
            include_git?: undefined;
        };
        required: string[];
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
            limit: {
                type: string;
                description: string;
            };
            name?: undefined;
            file?: undefined;
            kind?: undefined;
            symbol?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            contextLines?: undefined;
            reindex?: undefined;
            file_path?: undefined;
            content?: undefined;
            mode?: undefined;
            encoding?: undefined;
            module?: undefined;
            format?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            name: {
                type: string;
            };
            file: {
                type: string;
            };
            kind: {
                type: string;
            };
            limit: {
                type: string;
                description?: undefined;
            };
            query?: undefined;
            symbol?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            contextLines?: undefined;
            reindex?: undefined;
            file_path?: undefined;
            content?: undefined;
            mode?: undefined;
            encoding?: undefined;
            module?: undefined;
            format?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file: {
                type: string;
            };
            symbol: {
                type: string;
            };
            startLine: {
                type: string;
            };
            endLine: {
                type: string;
            };
            contextLines: {
                type: string;
            };
            query?: undefined;
            limit?: undefined;
            name?: undefined;
            kind?: undefined;
            reindex?: undefined;
            file_path?: undefined;
            content?: undefined;
            mode?: undefined;
            encoding?: undefined;
            module?: undefined;
            format?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            name: {
                type: string;
            };
            query?: undefined;
            limit?: undefined;
            file?: undefined;
            kind?: undefined;
            symbol?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            contextLines?: undefined;
            reindex?: undefined;
            file_path?: undefined;
            content?: undefined;
            mode?: undefined;
            encoding?: undefined;
            module?: undefined;
            format?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            reindex: {
                type: string;
            };
            query?: undefined;
            limit?: undefined;
            name?: undefined;
            file?: undefined;
            kind?: undefined;
            symbol?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            contextLines?: undefined;
            file_path?: undefined;
            content?: undefined;
            mode?: undefined;
            encoding?: undefined;
            module?: undefined;
            format?: undefined;
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
            };
            content: {
                type: string;
            };
            mode: {
                type: string;
            };
            encoding: {
                type: string;
            };
            query?: undefined;
            limit?: undefined;
            name?: undefined;
            file?: undefined;
            kind?: undefined;
            symbol?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            contextLines?: undefined;
            reindex?: undefined;
            module?: undefined;
            format?: undefined;
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
            };
            format: {
                type: string;
            };
            query?: undefined;
            limit?: undefined;
            name?: undefined;
            file?: undefined;
            kind?: undefined;
            symbol?: undefined;
            startLine?: undefined;
            endLine?: undefined;
            contextLines?: undefined;
            reindex?: undefined;
            file_path?: undefined;
            content?: undefined;
            mode?: undefined;
            encoding?: undefined;
        };
        required?: undefined;
    };
})[];
export declare function dispatchCodeIntelTool(name: string, args: Record<string, unknown>, dbManager: DatabaseManager, indexer: IndexingEngine, workspace: string): Promise<string>;
