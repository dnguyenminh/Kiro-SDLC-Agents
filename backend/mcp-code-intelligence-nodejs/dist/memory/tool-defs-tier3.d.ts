/** Tier 3 tool definitions — low-frequency scoring, admin, and conversation tools. */
export declare const TIER3_TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                description: string;
            };
            session_id: {
                type: string;
                description: string;
            };
            role: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
            tool_calls: {
                type: string;
                description: string;
            };
            query: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            entry_id?: undefined;
            type?: undefined;
            threshold?: undefined;
            rating?: undefined;
            comment?: undefined;
            operation?: undefined;
            days?: undefined;
            kind?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                description: string;
            };
            entry_id: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            threshold: {
                type: string;
                description: string;
            };
            rating: {
                type: string;
                description: string;
            };
            comment: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            session_id?: undefined;
            role?: undefined;
            tool_calls?: undefined;
            query?: undefined;
            operation?: undefined;
            days?: undefined;
            kind?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            operation: {
                type: string;
                description: string;
            };
            days: {
                type: string;
                description: string;
            };
            kind: {
                type: string;
                description: string;
            };
            session_id?: undefined;
            role?: undefined;
            content?: undefined;
            tool_calls?: undefined;
            query?: undefined;
            entry_id?: undefined;
            type?: undefined;
            threshold?: undefined;
            rating?: undefined;
            comment?: undefined;
        };
        required: string[];
    };
})[];
//# sourceMappingURL=tool-defs-tier3.d.ts.map