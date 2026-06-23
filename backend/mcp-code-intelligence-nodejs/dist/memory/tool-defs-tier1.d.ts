/** Tier 1 tool definitions — high-frequency standalone tools. */
export declare const TIER1_TOOLS: ({
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
            tier: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            detail: {
                type: string;
                description: string;
            };
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
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
            content: {
                type: string;
                description: string;
            };
            summary: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            source: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                description: string;
            };
            agent_name: {
                type: string;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            tier?: undefined;
            detail?: undefined;
            file_path?: undefined;
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
            file_path: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            format: {
                type: string;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            tier?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
        };
        required: string[];
    };
})[];
//# sourceMappingURL=tool-defs-tier1.d.ts.map