"use strict";
/** Tier 3 tool definitions — low-frequency scoring, admin, and conversation tools. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER3_TOOLS = void 0;
exports.TIER3_TOOLS = [
    {
        name: 'mem_conversation',
        description: 'Structured conversation history: save turns, query sessions, search conversation content.',
        inputSchema: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Action: save_turn, get_session, list_sessions, search, summarize' },
                session_id: { type: 'string', description: 'Session ID (for save_turn/get_session)' },
                role: { type: 'string', description: 'Role: user, assistant, system, tool (for save_turn)' },
                content: { type: 'string', description: 'Turn content (for save_turn)' },
                tool_calls: { type: 'string', description: 'JSON array of tool calls (for save_turn)' },
                query: { type: 'string', description: 'Search query (for search)' },
                limit: { type: 'number', description: 'Max results (default: 20)' },
            },
            required: ['action'],
        },
    },
    {
        name: 'mem_scoring',
        description: 'Quality & confidence scoring + feedback for entries.',
        inputSchema: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Action: quality_score, quality_stats, low_quality, validate, confidence, confidence_stats, unreliable, feedback_submit, feedback_view, top_rated, low_rated' },
                entry_id: { type: 'number', description: 'Entry ID' },
                content: { type: 'string', description: 'Content to validate (for validate action)' },
                type: { type: 'string', description: 'Entry type (for validate)' },
                threshold: { type: 'number', description: 'Quality threshold (default: 40)' },
                rating: { type: 'number', description: 'Rating: 1 (thumbs up) or -1 (thumbs down)' },
                comment: { type: 'string', description: 'Feedback comment' },
                limit: { type: 'number', description: 'Max results (default: 20)' },
            },
            required: ['action'],
        },
    },
    {
        name: 'mem_admin',
        description: 'System administration: status, audit trail, sessions, analytics, dashboard, code sync.',
        inputSchema: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Action: status, audit, sessions, analytics, dashboard, sync_code, popular, gaps, zero_results, metrics, recommendations, trends' },
                limit: { type: 'number', description: 'Max results (default: 20)' },
                operation: { type: 'string', description: 'Filter audit by operation: INGEST, DELETE, SEARCH, CONSOLIDATE, ACCESS' },
                days: { type: 'number', description: 'Trend period in days (default: 30)' },
                kind: { type: 'string', description: 'For sync_code: class, interface, function (default: class+interface)' },
            },
            required: ['action'],
        },
    },
];
//# sourceMappingURL=tool-defs-tier3.js.map