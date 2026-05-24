/**
 * Meta-tool dispatcher — routes meta-tool calls to handlers.
 * Behavioral parity with Kotlin MetaToolDispatcher.kt.
 */
import { OrchestrationEngine } from '../engine.js';
export declare const META_TOOL_DEFINITIONS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            ticket_key: {
                type: string;
                description: string;
            };
            agent_name: {
                type: string;
                description: string;
            };
            step: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            artifacts: {
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
            tool_name: {
                type: string;
                description: string;
            };
            server_name: {
                type: string;
                description: string;
            };
            auto_approve: {
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
            query: {
                type: string;
                description: string;
            };
            tool_name?: undefined;
            arguments?: undefined;
            server_name?: undefined;
            enabled?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            tool_name: {
                type: string;
                description: string;
            };
            arguments: {
                type: string;
                description: string;
            };
            query?: undefined;
            server_name?: undefined;
            enabled?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            tool_name: {
                type: string;
                description?: undefined;
            };
            server_name: {
                type: string;
            };
            enabled: {
                type: string;
            };
            query?: undefined;
            arguments?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            server_name: {
                type: string;
            };
            query?: undefined;
            tool_name?: undefined;
            arguments?: undefined;
            enabled?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query?: undefined;
            tool_name?: undefined;
            arguments?: undefined;
            server_name?: undefined;
            enabled?: undefined;
        };
        required?: undefined;
    };
})[];
export declare class MetaToolDispatcher {
    private engine;
    constructor(engine: OrchestrationEngine);
    /** Dispatch a meta-tool call. Returns null if not a meta-tool. */
    dispatch(toolName: string, args: Record<string, any>): Promise<string | null>;
    getDefinitions(): Record<string, any>[];
    private handleToggle;
    private handleReset;
    private handleStatus;
}
//# sourceMappingURL=dispatcher.d.ts.map