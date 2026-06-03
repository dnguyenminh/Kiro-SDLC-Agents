/**
 * Consolidated dispatcher — routes 17 tools + backward-compatible aliases.
 * Thin routing layer that delegates to existing V1/V2 handler classes.
 */

import { TOOL_ALIASES } from './tool-definitions-consolidated.js';
import type { MemoryToolDispatcherV2 } from './tool-dispatcher-v2.js';
import type { CoreMemoryManager } from './core-memory.js';
import type { EntityRepository } from './entity-repo.js';
import type { KnowledgeRepository } from './knowledge-repo.js';
import type { ConversationRepository } from './conversation-repo.js';
import type { ConversationSummarizer } from './conversation-summarizer.js';
import { extractStructuredMap } from './structured-map-extractor.js';
import { classifyEntity } from './entity-classifier.js';
import { KbEventEmitter, KbEventType } from '../http/kb-event-emitter.js';

type Args = Record<string, unknown>;
type V1Dispatcher = { dispatch(name: string, args: Args): string | null };

export class MemoryToolDispatcherConsolidated {
  private coreMemory: CoreMemoryManager | null = null;
  private entityRepo: EntityRepository | null = null;
  private knowledgeRepo: KnowledgeRepository | null = null;
  private conversationRepo: ConversationRepository | null = null;
  private conversationSummarizer: ConversationSummarizer | null = null;

  constructor(
    private readonly v1: V1Dispatcher,
    private readonly v2: MemoryToolDispatcherV2,
  ) {}

  /** Inject CoreMemoryManager after construction (avoids circular deps). */
  setCoreMemory(cm: CoreMemoryManager): void {
    this.coreMemory = cm;
  }

  /** Inject EntityRepository + KnowledgeRepository for mem_map. */
  setMapDeps(entityRepo: EntityRepository, knowledgeRepo: KnowledgeRepository): void {
    this.entityRepo = entityRepo;
    this.knowledgeRepo = knowledgeRepo;
  }

  /** Inject ConversationRepository + Summarizer for mem_conversation. */
  setConversationDeps(repo: ConversationRepository, summarizer: ConversationSummarizer): void {
    this.conversationRepo = repo;
    this.conversationSummarizer = summarizer;
  }

  /** Dispatch tool call. Handles new names + aliases. */
  dispatch(name: string, args: Args): string | null {
    const [resolved, mergedArgs] = this.resolveAlias(name, args);
    const handler = HANDLERS[resolved];
    if (!handler) return null;
    const result = handler(this, mergedArgs);
    // Emit KB change events for write operations
    if (result && !result.startsWith('Error:')) {
      const event = inferKbEvent(resolved, mergedArgs);
      if (event) {
        KbEventEmitter.getInstance().emitKbEvent(event, { tool: resolved, action: mergedArgs.action });
      }
    }
    return result;
  }

  private resolveAlias(name: string, args: Args): [string, Args] {
    const alias = TOOL_ALIASES[name];
    if (!alias) return [name, args];
    const [newName, defaults] = alias;
    return [newName, { ...defaults, ...args }];
  }
}

// --- Handler functions (delegate to V1/V2) ---

type Handler = (d: MemoryToolDispatcherConsolidated, a: Args) => string;

function handlePin(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const cm = d['coreMemory'];
  if (!cm) return 'Error: CoreMemoryManager not initialized';
  const action = (a.action as string) || 'list';
  const entryId = a.entry_id as number | undefined;
  switch (action) {
    case 'pin':
      if (!entryId) return 'Error: entry_id required for pin';
      return cm.pin(entryId);
    case 'unpin':
      if (!entryId) return 'Error: entry_id required for unpin';
      return cm.unpin(entryId);
    case 'list':
      return JSON.stringify(cm.listPinned(), null, 2);
    case 'reorder':
      if (!entryId) return 'Error: entry_id required for reorder';
      return cm.reorder(entryId, (a.order as number) ?? 0);
    case 'get_context':
      return cm.getContext() || '(no pinned entries)';
    case 'budget':
      return JSON.stringify(cm.getBudgetStatus(), null, 2);
    default:
      return `Error: unknown pin action: ${action}`;
  }
}

function handleMap(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const action = (a.action as string) || 'get';
  const entryId = a.entry_id as number | undefined;
  const entityRepoInst = d['entityRepo'];
  const knowledgeRepoInst = d['knowledgeRepo'];

  switch (action) {
    case 'get': {
      if (!entryId) return 'Error: entry_id required';
      if (!knowledgeRepoInst) return 'Error: KnowledgeRepository not initialized';
      const mapJson = knowledgeRepoInst.getStructuredMap(entryId);
      return mapJson;
    }
    case 'update': {
      if (!entryId) return 'Error: entry_id required';
      if (!knowledgeRepoInst) return 'Error: KnowledgeRepository not initialized';
      const existing = JSON.parse(knowledgeRepoInst.getStructuredMap(entryId));
      const updates = a.map as Record<string, unknown> ?? {};
      const merged = { ...existing, ...updates };
      knowledgeRepoInst.updateStructuredMap(entryId, JSON.stringify(merged));
      return `Updated structured map for entry ${entryId}`;
    }
    case 'search_entity': {
      const entity = a.entity as string;
      if (!entity) return 'Error: entity required for search_entity';
      if (!entityRepoInst) return 'Error: EntityRepository not initialized';
      const limit = (a.limit as number) ?? 10;
      const ids = entityRepoInst.findByEntity(entity, limit);
      if (ids.length === 0) return `No entries mention entity "${entity}"`;
      return JSON.stringify({ entity, entry_ids: ids, count: ids.length });
    }
    case 'search_topic': {
      if (!knowledgeRepoInst) return 'Error: KnowledgeRepository not initialized';
      const topic = a.topic as string;
      if (!topic) return 'Error: topic required for search_topic';
      // Search structured_map JSON for topic match
      return `Topic search for "${topic}" — use mem_search with query instead`;
    }
    case 'reextract': {
      if (!entryId) return 'Error: entry_id required';
      if (!knowledgeRepoInst) return 'Error: KnowledgeRepository not initialized';
      const entry = knowledgeRepoInst.findById(entryId);
      if (!entry) return `Error: entry ${entryId} not found`;
      const map = extractStructuredMap(entry.content);
      const mapJson = JSON.stringify(map);
      knowledgeRepoInst.updateStructuredMap(entryId, mapJson);
      if (entityRepoInst && map.entities_mentioned.length > 0) {
        const entities = map.entities_mentioned.map(name => ({ name, type: classifyEntity(name) }));
        entityRepoInst.indexEntities(entryId, entities);
      }
      return `Re-extracted map for entry ${entryId}: ${map.entities_mentioned.length} entities, topic="${map.topic}"`;
    }
    default:
      return `Error: unknown map action: ${action}`;
  }
}

function handleConversation(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const convRepo = d['conversationRepo'];
  const summarizer = d['conversationSummarizer'];
  if (!convRepo) return 'Error: ConversationRepository not initialized';
  const action = (a.action as string) || 'list_sessions';

  switch (action) {
    case 'save_turn': {
      const sessionId = a.session_id as string;
      if (!sessionId) return 'Error: session_id required';
      const role = a.role as string;
      if (!role) return 'Error: role required';
      const content = a.content as string;
      if (!content) return 'Error: content required';
      const toolCalls = a.tool_calls ? JSON.parse(a.tool_calls as string) : undefined;
      const id = convRepo.saveTurn(sessionId, role, content, toolCalls);
      return `Saved turn #${convRepo.getSessionTurnCount(sessionId)} (id=${id}) for session ${sessionId}`;
    }
    case 'get_session': {
      const sessionId = a.session_id as string;
      if (!sessionId) return 'Error: session_id required';
      const limit = (a.limit as number) ?? 50;
      const turns = convRepo.getSession(sessionId, limit);
      if (turns.length === 0) return `No turns found for session ${sessionId}`;
      const lines = [`Session ${sessionId} (${turns.length} turns):\n`];
      for (const t of turns) {
        lines.push(`[${t.turn_number}] ${t.role}: ${t.content.slice(0, 200)}`);
      }
      return lines.join('\n');
    }
    case 'list_sessions': {
      const limit = (a.limit as number) ?? 20;
      const sessions = convRepo.listSessions(limit);
      if (sessions.length === 0) return 'No conversation sessions found';
      const lines = [`${sessions.length} sessions:\n`];
      for (const s of sessions) {
        lines.push(`[${s.session_id}] ${s.turn_count} turns | Roles: ${s.roles.join(',')} | Last: ${s.last_turn_at}`);
      }
      return lines.join('\n');
    }
    case 'search': {
      const query = a.query as string;
      if (!query) return 'Error: query required for search';
      const limit = (a.limit as number) ?? 20;
      const turns = convRepo.searchTurns(query, limit);
      if (turns.length === 0) return `No turns matching "${query}"`;
      const lines = [`Found ${turns.length} turns:\n`];
      for (const t of turns) {
        lines.push(`[${t.session_id}#${t.turn_number}] ${t.role}: ${t.content.slice(0, 150)}`);
      }
      return lines.join('\n');
    }
    case 'summarize': {
      const sessionId = a.session_id as string;
      if (!sessionId) return 'Error: session_id required';
      if (!summarizer) return 'Error: ConversationSummarizer not initialized';
      const result = summarizer.summarizeSession(sessionId);
      if (!result) return `No turns to summarize for session ${sessionId}`;
      return `Summarized ${result.turnsProcessed} turns → entry #${result.summaryEntryId}`;
    }
    default:
      return `Error: unknown conversation action: ${action}`;
  }
}

function handleSearch(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v1'].dispatch('mem_search', a) ?? 'Error: search failed';
}

function handleIngest(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v1'].dispatch('mem_ingest', a) ?? 'Error: ingest failed';
}

function handleIngestFile(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v1'].dispatch('mem_ingest_file', a) ?? 'Error: ingest_file failed';
}

function handleCrud(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const action = (a.action as string) || 'list';
  const nameMap: Record<string, string> = { get: 'mem_get', delete: 'mem_delete', list: 'mem_list' };
  return d['v1'].dispatch(nameMap[action] ?? 'mem_list', a) ?? 'Error: crud failed';
}

function handleGraph(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v1'].dispatch('mem_graph', a) ?? 'Error: graph failed';
}

function handleConsolidate(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v2'].dispatch('mem_consolidate_v2', a) ?? 'Error: consolidate failed';
}

function handleLifecycle(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const action = (a.action as string) || 'detect_stale';
  const routes: Record<string, () => string | null> = {
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

function handleTemplates(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v2'].dispatch('mem_templates', a) ?? 'Error: templates failed';
}

function handleAttachments(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v2'].dispatch('mem_attachments', a) ?? 'Error: attachments failed';
}

function handleDiscover(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const action = (a.action as string) || 'suggest';
  if (action === 'related') {
    return d['v2'].dispatch('mem_related', a) ?? 'Error: related failed';
  }
  return d['v2'].dispatch('mem_suggest', a) ?? 'Error: suggest failed';
}

function handleTags(d: MemoryToolDispatcherConsolidated, a: Args): string {
  return d['v2'].dispatch('mem_tags', a) ?? 'Error: tags failed';
}

function handleCitations(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const action = (a.action as string) || 'most_cited';
  if (action === 'record') {
    return d['v2'].dispatch('mem_cite', a) ?? 'Error: cite failed';
  }
  return d['v2'].dispatch('mem_citations', { ...a, action }) ?? 'Error: citations failed';
}

function handleScoring(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const action = (a.action as string) || 'quality_stats';
  const qualityActions = ['quality_score', 'quality_stats', 'low_quality', 'validate'];
  const confidenceActions = ['confidence', 'confidence_stats', 'unreliable'];
  const feedbackActions = ['feedback_submit', 'feedback_view', 'top_rated', 'low_rated'];

  if (qualityActions.includes(action)) {
    const map: Record<string, string> = { quality_score: 'score', quality_stats: 'stats', low_quality: 'low_quality', validate: 'validate' };
    return d['v2'].dispatch('mem_quality', { ...a, action: map[action] ?? 'stats' }) ?? '';
  }
  if (confidenceActions.includes(action)) {
    const map: Record<string, string> = { confidence: 'compute', confidence_stats: 'stats', unreliable: 'unreliable' };
    return d['v2'].dispatch('mem_confidence', { ...a, action: map[action] ?? 'stats' }) ?? '';
  }
  if (feedbackActions.includes(action)) {
    const map: Record<string, string> = { feedback_submit: 'submit', feedback_view: 'summary', top_rated: 'top_rated', low_rated: 'low_rated' };
    return d['v2'].dispatch('mem_feedback', { ...a, action: map[action] ?? 'summary' }) ?? '';
  }
  return `Error: unknown scoring action: ${action}`;
}

function handleAdmin(d: MemoryToolDispatcherConsolidated, a: Args): string {
  const action = (a.action as string) || 'status';
  const v1Actions: Record<string, string> = { status: 'mem_status', audit: 'mem_audit', sessions: 'mem_sessions', sync_code: 'mem_sync_code' };
  if (v1Actions[action]) {
    return d['v1'].dispatch(v1Actions[action], a) ?? '';
  }
  const analyticsActions = ['analytics', 'popular', 'gaps', 'zero_results'];
  if (analyticsActions.includes(action)) {
    const map: Record<string, string> = { analytics: 'summary', popular: 'popular', gaps: 'gaps', zero_results: 'zero_results' };
    return d['v2'].dispatch('mem_analytics', { ...a, action: map[action] }) ?? '';
  }
  const dashActions = ['dashboard', 'metrics', 'recommendations', 'trends'];
  if (dashActions.includes(action)) {
    const map: Record<string, string> = { dashboard: 'full', metrics: 'metrics', recommendations: 'recommendations', trends: 'trends' };
    return d['v2'].dispatch('mem_dashboard', { ...a, action: map[action] }) ?? '';
  }
  return `Error: unknown admin action: ${action}`;
}

const HANDLERS: Record<string, Handler> = {
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

/** Map tool+action to a KbEventType. Returns null for read-only operations. */
function inferKbEvent(tool: string, args: Args): KbEventType | null {
  switch (tool) {
    case 'mem_ingest':
    case 'mem_ingest_file':
      return 'kb_entry_added';
    case 'mem_crud': {
      const action = args.action as string;
      if (action === 'delete') return 'kb_entry_deleted';
      if (action === 'update') return 'kb_entry_updated';
      return null; // get, list are reads
    }
    case 'mem_tags': {
      const action = args.action as string;
      if (action === 'create') return 'tag_created';
      if (action === 'delete') return 'tag_deleted';
      if (action === 'tag' || action === 'untag') return 'tag_updated';
      return null; // taxonomy, popular, search are reads
    }
    case 'mem_scoring': {
      const action = args.action as string;
      if (action === 'quality_score' || action === 'feedback_submit') return 'quality_scored';
      return null; // stats, low_quality are reads
    }
    case 'mem_lifecycle': {
      const action = args.action as string;
      if (action === 'archive' || action === 'unarchive' || action === 'mark_reviewed') return 'kb_entry_updated';
      return null;
    }
    case 'mem_consolidate':
      return 'consolidation_complete';
    default:
      return null;
  }
}
