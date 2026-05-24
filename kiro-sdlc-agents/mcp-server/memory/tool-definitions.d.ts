/**
 * MCP tool definitions for memory engine. Prefix: mem_
 * Now exports consolidated 14 tools (KSA-85) instead of 12 V1 + 17 V2.
 */
export declare const MEMORY_TOOL_DEFINITIONS: ({
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
            order: {
                type: string;
                description: string;
            };
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            limit?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
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
            entity: {
                type: string;
                description: string;
            };
            topic: {
                type: string;
                description: string;
            };
            map: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            order?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
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
            id: {
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
            limit: {
                type: string;
                description: string;
            };
            entry_id?: undefined;
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
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
            node_id: {
                type: string;
                description: string;
            };
            source_id: {
                type: string;
                description: string;
            };
            target_id: {
                type: string;
                description: string;
            };
            relation: {
                type: string;
                description: string;
            };
            from_id: {
                type: string;
                description: string;
            };
            to_id: {
                type: string;
                description: string;
            };
            radius: {
                type: string;
                description: string;
            };
            entry_id?: undefined;
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            limit?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
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
            entry_id?: undefined;
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            limit?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
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
            threshold: {
                type: string;
                description: string;
            };
            dry_run: {
                type: string;
                description: string;
            };
            days: {
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
            reviewer: {
                type: string;
                description: string;
            };
            assignee: {
                type: string;
                description: string;
            };
            owner: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
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
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            limit?: undefined;
            id?: undefined;
            tier?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
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
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            limit?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
            status?: undefined;
            name?: undefined;
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
            query: {
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
            refresh: {
                type: string;
                description: string;
            };
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
            status?: undefined;
            name?: undefined;
            required_sections?: undefined;
            file_path?: undefined;
            description?: undefined;
            attachment_id?: undefined;
            mime_prefix?: undefined;
            tag?: undefined;
            tags?: undefined;
            category?: undefined;
            parent_tag?: undefined;
            operator?: undefined;
            cited_by?: undefined;
            context?: undefined;
            agent?: undefined;
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
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
            status?: undefined;
            name?: undefined;
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
            cited_by: {
                type: string;
                description: string;
            };
            context: {
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
            order?: undefined;
            entity?: undefined;
            topic?: undefined;
            map?: undefined;
            id?: undefined;
            tier?: undefined;
            type?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            dry_run?: undefined;
            survivor_id?: undefined;
            merge_ids?: undefined;
            strategy?: undefined;
            threshold?: undefined;
            days?: undefined;
            interval_days?: undefined;
            snooze_days?: undefined;
            reviewer?: undefined;
            assignee?: undefined;
            owner?: undefined;
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
export declare const MEMORY_TOOL_DEFINITIONS_V1: ({
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
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
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
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
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
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
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
            id: {
                type: string;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            tier?: undefined;
            type?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
            format?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
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
            tier: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            query?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
            format?: undefined;
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
            kind?: undefined;
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
            node_id: {
                type: string;
                description: string;
            };
            source_id: {
                type: string;
                description: string;
            };
            target_id: {
                type: string;
                description: string;
            };
            relation: {
                type: string;
                description: string;
            };
            from_id: {
                type: string;
                description: string;
            };
            to_id: {
                type: string;
                description: string;
            };
            radius: {
                type: string;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            tier?: undefined;
            type?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
            format?: undefined;
            id?: undefined;
            operation?: undefined;
            kind?: undefined;
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
            limit?: undefined;
            tier?: undefined;
            type?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
            format?: undefined;
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
            kind?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            limit: {
                type: string;
                description: string;
            };
            operation: {
                type: string;
                description: string;
            };
            query?: undefined;
            tier?: undefined;
            type?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
            format?: undefined;
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            kind?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            limit: {
                type: string;
                description: string;
            };
            query?: undefined;
            tier?: undefined;
            type?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
            format?: undefined;
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
            kind?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            kind: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            query?: undefined;
            tier?: undefined;
            type?: undefined;
            detail?: undefined;
            content?: undefined;
            summary?: undefined;
            source?: undefined;
            tags?: undefined;
            agent_name?: undefined;
            file_path?: undefined;
            format?: undefined;
            id?: undefined;
            action?: undefined;
            node_id?: undefined;
            source_id?: undefined;
            target_id?: undefined;
            relation?: undefined;
            from_id?: undefined;
            to_id?: undefined;
            radius?: undefined;
            operation?: undefined;
        };
        required?: undefined;
    };
})[];
//# sourceMappingURL=tool-definitions.d.ts.map