/**
 * MCP tool definitions V2 — KB Enhancement tools (KSA-68).
 * 17 new tools for governance, quality, findability, AI-ready, UX pillars.
 */
export declare const MEMORY_TOOL_DEFINITIONS_V2: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                description: string;
            };
            dry_run: {
                type: string;
                description: string;
            };
            survivor_id: {
                type: string;
                description: string;
            };
            merge_ids: {
                type: string;
                description: string;
            };
            strategy: {
                type: string;
                description: string;
            };
            threshold?: undefined;
            entry_id?: undefined;
            days?: undefined;
            limit?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            threshold: {
                type: string;
                description: string;
            };
            entry_id: {
                type: string;
                description: string;
            };
            dry_run: {
                type: string;
                description: string;
            };
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            days?: undefined;
            limit?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            days: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            action?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            entry_id?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            owner: {
                type: string;
                description: string;
            };
            reviewer: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            limit?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
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
            name: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            required_sections: {
                type: string;
                description: string;
            };
            entry_id: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            limit?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            file_path: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            attachment_id: {
                type: string;
                description: string;
            };
            mime_prefix: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            limit?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
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
            action?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            entry_id?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            entry_id: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            refresh: {
                type: string;
                description: string;
            };
            action?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
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
            tag: {
                type: string;
                description: string;
            };
            tags: {
                type: string;
                description: string;
            };
            entry_id: {
                type: string;
                description: string;
            };
            category: {
                type: string;
                description: string;
            };
            parent_tag: {
                type: string;
                description: string;
            };
            operator: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            entry_id?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            entry_id: {
                type: string;
                description: string;
            };
            cited_by: {
                type: string;
                description: string;
            };
            context: {
                type: string;
                description: string;
            };
            action?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            limit?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
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
            agent: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            interval_days: {
                type: string;
                description: string;
            };
            snooze_days: {
                type: string;
                description: string;
            };
            assignee: {
                type: string;
                description: string;
            };
            reviewer: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            owner?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            limit: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
        };
        required?: undefined;
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
            limit: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
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
            days: {
                type: string;
                description: string;
            };
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            entry_id?: undefined;
            limit?: undefined;
            owner?: undefined;
            reviewer?: undefined;
            status?: undefined;
            name?: undefined;
            type?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            query?: undefined;
            refresh?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
            rating?: undefined;
            comment?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            assignee?: undefined;
            content?: undefined;
        };
        required?: undefined;
    };
})[];
//# sourceMappingURL=tool-definitions-v2.d.ts.map