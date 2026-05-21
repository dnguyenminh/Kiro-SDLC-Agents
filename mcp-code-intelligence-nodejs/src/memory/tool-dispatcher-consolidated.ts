/**
 * Consolidated dispatcher — routes 14 tools + backward-compatible aliases.
 * Thin routing layer that delegates to existing V1/V2 handler classes.
 */

import { TOOL_ALIASES } from './tool-definitions-consolidated.js';
import type { MemoryToolDispatcherV2 } from './tool-dispatcher-v2.js';

type Args = Record<string, unknown>;
type V1Dispatcher = { dispatch(name: string, args: Args): string | null };

export class MemoryToolDispatcherConsolidated {
  constructor(
    private readonly v1: V1Dispatcher,
    private readonly v2: MemoryToolDispatcherV2,
  ) {}

  /** Dispatch tool call. Handles new names + aliases. */
  dispatch(name: string, args: Args): string | null {
    const [resolved, mergedArgs] = this.resolveAlias(name, args);
    const handler = HANDLERS[resolved];
    if (!handler) return null;
    return handler(this, mergedArgs);
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
