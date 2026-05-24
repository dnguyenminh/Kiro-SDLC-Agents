/**
 * Schema V4 — Agent identification for knowledge entries.
 * Adds agent_name column to track which agent created each entry.
 */
/** Add agent_name column to knowledge_entries. */
export declare const SCHEMA_V4_AGENT_NAME_ALTER: string[];
export declare const SCHEMA_V4_AGENT_NAME_INDEX = "\nCREATE INDEX IF NOT EXISTS idx_ke_agent_name ON knowledge_entries(agent_name);\n";
//# sourceMappingURL=schema-v4.d.ts.map