"use strict";
/**
 * Schema V4 — Agent identification for knowledge entries.
 * Adds agent_name column to track which agent created each entry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_V4_AGENT_NAME_INDEX = exports.SCHEMA_V4_AGENT_NAME_ALTER = void 0;
/** Add agent_name column to knowledge_entries. */
exports.SCHEMA_V4_AGENT_NAME_ALTER = [
    'ALTER TABLE knowledge_entries ADD COLUMN agent_name TEXT DEFAULT NULL',
];
exports.SCHEMA_V4_AGENT_NAME_INDEX = `
CREATE INDEX IF NOT EXISTS idx_ke_agent_name ON knowledge_entries(agent_name);
`;
//# sourceMappingURL=schema-v4.js.map