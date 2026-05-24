"use strict";
/**
 * Consolidated dispatcher — routes 17 tools + backward-compatible aliases.
 * Thin routing layer that delegates to existing V1/V2 handler classes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryToolDispatcherConsolidated = void 0;
const tool_definitions_consolidated_js_1 = require("./tool-definitions-consolidated.js");
const structured_map_extractor_js_1 = require("./structured-map-extractor.js");
const entity_classifier_js_1 = require("./entity-classifier.js");
class MemoryToolDispatcherConsolidated {
    v1;
    v2;
    coreMemory = null;
    entityRepo = null;
    knowledgeRepo = null;
    conversationRepo = null;
    conversationSummarizer = null;
    constructor(v1, v2) {
        this.v1 = v1;
        this.v2 = v2;
    }
    /** Inject CoreMemoryManager after construction (avoids circular deps). */
    setCoreMemory(cm) {
        this.coreMemory = cm;
    }
    /** Inject EntityRepository + KnowledgeRepository for mem_map. */
    setMapDeps(entityRepo, knowledgeRepo) {
        this.entityRepo = entityRepo;
        this.knowledgeRepo = knowledgeRepo;
    }
    /** Inject ConversationRepository + Summarizer for mem_conversation. */
    setConversationDeps(repo, summarizer) {
        this.conversationRepo = repo;
        this.conversationSummarizer = summarizer;
    }
    /** Dispatch tool call. Handles new names + aliases. */
    dispatch(name, args) {
        const [resolved, mergedArgs] = this.resolveAlias(name, args);
        const handler = HANDLERS[resolved];
        if (!handler)
            return null;
        return handler(this, mergedArgs);
    }
    resolveAlias(name, args) {
        const alias = tool_definitions_consolidated_js_1.TOOL_ALIASES[name];
        if (!alias)
            return [name, args];
        const [newName, defaults] = alias;
        return [newName, { ...defaults, ...args }];
    }
}
exports.MemoryToolDispatcherConsolidated = MemoryToolDispatcherConsolidated;
function handlePin(d, a) {
    const cm = d['coreMemory'];
    if (!cm)
        return 'Error: CoreMemoryManager not initialized';
    const action = a.action || 'list';
    const entryId = a.entry_id;
    switch (action) {
        case 'pin':
            if (!entryId)
                return 'Error: entry_id required for pin';
            return cm.pin(entryId);
        case 'unpin':
            if (!entryId)
                return 'Error: entry_id required for unpin';
            return cm.unpin(entryId);
        case 'list':
            return JSON.stringify(cm.listPinned(), null, 2);
        case 'reorder':
            if (!entryId)
                return 'Error: entry_id required for reorder';
            return cm.reorder(entryId, a.order ?? 0);
        case 'get_context':
            return cm.getContext() || '(no pinned entries)';
        case 'budget':
            return JSON.stringify(cm.getBudgetStatus(), null, 2);
        default:
            return `Error: unknown pin action: ${action}`;
    }
}
function handleMap(d, a) {
    const action = a.action || 'get';
    const entryId = a.entry_id;
    const entityRepoInst = d['entityRepo'];
    const knowledgeRepoInst = d['knowledgeRepo'];
    switch (action) {
        case 'get': {
            if (!entryId)
                return 'Error: entry_id required';
            if (!knowledgeRepoInst)
                return 'Error: KnowledgeRepository not initialized';
            const mapJson = knowledgeRepoInst.getStructuredMap(entryId);
            return mapJson;
        }
        case 'update': {
            if (!entryId)
                return 'Error: entry_id required';
            if (!knowledgeRepoInst)
                return 'Error: KnowledgeRepository not initialized';
            const existing = JSON.parse(knowledgeRepoInst.getStructuredMap(entryId));
            const updates = a.map ?? {};
            const merged = { ...existing, ...updates };
            knowledgeRepoInst.updateStructuredMap(entryId, JSON.stringify(merged));
            return `Updated structured map for entry ${entryId}`;
        }
        case 'search_entity': {
            const entity = a.entity;
            if (!entity)
                return 'Error: entity required for search_entity';
            if (!entityRepoInst)
                return 'Error: EntityRepository not initialized';
            const limit = a.limit ?? 10;
            const ids = entityRepoInst.findByEntity(entity, limit);
            if (ids.length === 0)
                return `No entries mention entity "${entity}"`;
            return JSON.stringify({ entity, entry_ids: ids, count: ids.length });
        }
        case 'search_topic': {
            if (!knowledgeRepoInst)
                return 'Error: KnowledgeRepository not initialized';
            const topic = a.topic;
            if (!topic)
                return 'Error: topic required for search_topic';
            // Search structured_map JSON for topic match
            return `Topic search for "${topic}" — use mem_search with query instead`;
        }
        case 'reextract': {
            if (!entryId)
                return 'Error: entry_id required';
            if (!knowledgeRepoInst)
                return 'Error: KnowledgeRepository not initialized';
            const entry = knowledgeRepoInst.findById(entryId);
            if (!entry)
                return `Error: entry ${entryId} not found`;
            const map = (0, structured_map_extractor_js_1.extractStructuredMap)(entry.content);
            const mapJson = JSON.stringify(map);
            knowledgeRepoInst.updateStructuredMap(entryId, mapJson);
            if (entityRepoInst && map.entities_mentioned.length > 0) {
                const entities = map.entities_mentioned.map(name => ({ name, type: (0, entity_classifier_js_1.classifyEntity)(name) }));
                entityRepoInst.indexEntities(entryId, entities);
            }
            return `Re-extracted map for entry ${entryId}: ${map.entities_mentioned.length} entities, topic="${map.topic}"`;
        }
        default:
            return `Error: unknown map action: ${action}`;
    }
}
function handleConversation(d, a) {
    const convRepo = d['conversationRepo'];
    const summarizer = d['conversationSummarizer'];
    if (!convRepo)
        return 'Error: ConversationRepository not initialized';
    const action = a.action || 'list_sessions';
    switch (action) {
        case 'save_turn': {
            const sessionId = a.session_id;
            if (!sessionId)
                return 'Error: session_id required';
            const role = a.role;
            if (!role)
                return 'Error: role required';
            const content = a.content;
            if (!content)
                return 'Error: content required';
            const toolCalls = a.tool_calls ? JSON.parse(a.tool_calls) : undefined;
            const id = convRepo.saveTurn(sessionId, role, content, toolCalls);
            return `Saved turn #${convRepo.getSessionTurnCount(sessionId)} (id=${id}) for session ${sessionId}`;
        }
        case 'get_session': {
            const sessionId = a.session_id;
            if (!sessionId)
                return 'Error: session_id required';
            const limit = a.limit ?? 50;
            const turns = convRepo.getSession(sessionId, limit);
            if (turns.length === 0)
                return `No turns found for session ${sessionId}`;
            const lines = [`Session ${sessionId} (${turns.length} turns):\n`];
            for (const t of turns) {
                lines.push(`[${t.turn_number}] ${t.role}: ${t.content.slice(0, 200)}`);
            }
            return lines.join('\n');
        }
        case 'list_sessions': {
            const limit = a.limit ?? 20;
            const sessions = convRepo.listSessions(limit);
            if (sessions.length === 0)
                return 'No conversation sessions found';
            const lines = [`${sessions.length} sessions:\n`];
            for (const s of sessions) {
                lines.push(`[${s.session_id}] ${s.turn_count} turns | Roles: ${s.roles.join(',')} | Last: ${s.last_turn_at}`);
            }
            return lines.join('\n');
        }
        case 'search': {
            const query = a.query;
            if (!query)
                return 'Error: query required for search';
            const limit = a.limit ?? 20;
            const turns = convRepo.searchTurns(query, limit);
            if (turns.length === 0)
                return `No turns matching "${query}"`;
            const lines = [`Found ${turns.length} turns:\n`];
            for (const t of turns) {
                lines.push(`[${t.session_id}#${t.turn_number}] ${t.role}: ${t.content.slice(0, 150)}`);
            }
            return lines.join('\n');
        }
        case 'summarize': {
            const sessionId = a.session_id;
            if (!sessionId)
                return 'Error: session_id required';
            if (!summarizer)
                return 'Error: ConversationSummarizer not initialized';
            const result = summarizer.summarizeSession(sessionId);
            if (!result)
                return `No turns to summarize for session ${sessionId}`;
            return `Summarized ${result.turnsProcessed} turns → entry #${result.summaryEntryId}`;
        }
        default:
            return `Error: unknown conversation action: ${action}`;
    }
}
function handleSearch(d, a) {
    return d['v1'].dispatch('mem_search', a) ?? 'Error: search failed';
}
function handleIngest(d, a) {
    return d['v1'].dispatch('mem_ingest', a) ?? 'Error: ingest failed';
}
function handleIngestFile(d, a) {
    return d['v1'].dispatch('mem_ingest_file', a) ?? 'Error: ingest_file failed';
}
function handleCrud(d, a) {
    const action = a.action || 'list';
    const nameMap = { get: 'mem_get', delete: 'mem_delete', list: 'mem_list' };
    return d['v1'].dispatch(nameMap[action] ?? 'mem_list', a) ?? 'Error: crud failed';
}
function handleGraph(d, a) {
    return d['v1'].dispatch('mem_graph', a) ?? 'Error: graph failed';
}
function handleConsolidate(d, a) {
    return d['v2'].dispatch('mem_consolidate_v2', a) ?? 'Error: consolidate failed';
}
function handleLifecycle(d, a) {
    const action = a.action || 'detect_stale';
    const routes = {
        detect_stale: () => d['v2'].dispatch('mem_stale', { ...a, action: 'detect' }),
        archive: () => d['v2'].dispatch('mem_stale', { ...a, action: 'archive' }),
        unarchive: () => d['v2'].dispatch('mem_stale', { ...a, action: 'unarchive' }),
        due_reviews: () => d['v2'].dispatch('mem_due_reviews', a),
        mark_reviewed: () => d['v2'].dispatch('mem_review', { ...a, action: 'mark_reviewed' }),
        schedule: () => d['v2'].dispatch('mem_reminders', { ...a, action: 'schedule' }),
        snooze: () => d['v2'].dispatch('mem_reminders', { ...a, action: 'snooze' }),
        complete: () => d['v2'].dispatch('mem_reminders', { ...a, action: 'complete' }),
    };
    const route = routes[action];
    return route?.() ?? `Error: unknown lifecycle action: ${action}`;
}
function handleTemplates(d, a) {
    return d['v2'].dispatch('mem_templates', a) ?? 'Error: templates failed';
}
function handleAttachments(d, a) {
    return d['v2'].dispatch('mem_attachments', a) ?? 'Error: attachments failed';
}
function handleDiscover(d, a) {
    const action = a.action || 'suggest';
    if (action === 'related') {
        return d['v2'].dispatch('mem_related', a) ?? 'Error: related failed';
    }
    return d['v2'].dispatch('mem_suggest', a) ?? 'Error: suggest failed';
}
function handleTags(d, a) {
    return d['v2'].dispatch('mem_tags', a) ?? 'Error: tags failed';
}
function handleCitations(d, a) {
    const action = a.action || 'most_cited';
    if (action === 'record') {
        return d['v2'].dispatch('mem_cite', a) ?? 'Error: cite failed';
    }
    return d['v2'].dispatch('mem_citations', { ...a, action }) ?? 'Error: citations failed';
}
function handleScoring(d, a) {
    const action = a.action || 'quality_stats';
    const qualityActions = ['quality_score', 'quality_stats', 'low_quality', 'validate'];
    const confidenceActions = ['confidence', 'confidence_stats', 'unreliable'];
    const feedbackActions = ['feedback_submit', 'feedback_view', 'top_rated', 'low_rated'];
    if (qualityActions.includes(action)) {
        const map = { quality_score: 'score', quality_stats: 'stats', low_quality: 'low_quality', validate: 'validate' };
        return d['v2'].dispatch('mem_quality', { ...a, action: map[action] ?? 'stats' }) ?? '';
    }
    if (confidenceActions.includes(action)) {
        const map = { confidence: 'compute', confidence_stats: 'stats', unreliable: 'unreliable' };
        return d['v2'].dispatch('mem_confidence', { ...a, action: map[action] ?? 'stats' }) ?? '';
    }
    if (feedbackActions.includes(action)) {
        const map = { feedback_submit: 'submit', feedback_view: 'summary', top_rated: 'top_rated', low_rated: 'low_rated' };
        return d['v2'].dispatch('mem_feedback', { ...a, action: map[action] ?? 'summary' }) ?? '';
    }
    return `Error: unknown scoring action: ${action}`;
}
function handleAdmin(d, a) {
    const action = a.action || 'status';
    const v1Actions = { status: 'mem_status', audit: 'mem_audit', sessions: 'mem_sessions', sync_code: 'mem_sync_code' };
    if (v1Actions[action]) {
        return d['v1'].dispatch(v1Actions[action], a) ?? '';
    }
    const analyticsActions = ['analytics', 'popular', 'gaps', 'zero_results'];
    if (analyticsActions.includes(action)) {
        const map = { analytics: 'summary', popular: 'popular', gaps: 'gaps', zero_results: 'zero_results' };
        return d['v2'].dispatch('mem_analytics', { ...a, action: map[action] }) ?? '';
    }
    const dashActions = ['dashboard', 'metrics', 'recommendations', 'trends'];
    if (dashActions.includes(action)) {
        const map = { dashboard: 'full', metrics: 'metrics', recommendations: 'recommendations', trends: 'trends' };
        return d['v2'].dispatch('mem_dashboard', { ...a, action: map[action] }) ?? '';
    }
    return `Error: unknown admin action: ${action}`;
}
const HANDLERS = {
    mem_pin: handlePin,
    mem_map: handleMap,
    mem_conversation: handleConversation,
    mem_search: handleSearch,
    mem_ingest: handleIngest,
    mem_ingest_file: handleIngestFile,
    mem_crud: handleCrud,
    mem_graph: handleGraph,
    mem_consolidate: handleConsolidate,
    mem_lifecycle: handleLifecycle,
    mem_templates: handleTemplates,
    mem_attachments: handleAttachments,
    mem_discover: handleDiscover,
    mem_tags: handleTags,
    mem_citations: handleCitations,
    mem_scoring: handleScoring,
    mem_admin: handleAdmin,
};
//# sourceMappingURL=tool-dispatcher-consolidated.js.map