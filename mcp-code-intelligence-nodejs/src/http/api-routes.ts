/**
 * REST API route handlers for memory engine — search, list, graph, stats.
 * Port of Kotlin MemoryApiRoutes.kt.
 */

import * as http from 'http';
import { MemoryEngine } from '../memory/memory-engine.js';
import { KnowledgeGraph } from '../memory/knowledge-graph.js';
import { KnowledgeEntry } from '../memory/models.js';

/** Dispatch API requests to the correct handler. */
export function handleApiRoute(
  url: URL,
  res: http.ServerResponse,
  engine: MemoryEngine | null,
  graph: KnowledgeGraph | null
): void {
  const path = url.pathname.replace('/api/memory', '');

  if (path === '/status') handleStatus(res, engine);
  else if (path === '/search') handleSearch(url, res, engine);
  else if (path.match(/^\/entries\/\d+$/)) handleGetEntry(path, res, engine);
  else if (path === '/entries') handleListEntries(url, res, engine);
  else if (path === '/sessions') handleSessions(url, res, engine);
  else if (path.match(/^\/sessions\/[^/]+\/events$/)) handleSessionEvents(path, url, res, engine);
  else if (path.match(/^\/graph\/\d+\/neighbors$/)) handleNeighbors(path, res, engine, graph);
  else if (path === '/graph/data') handleGraphData(url, res, engine, graph);
  else sendError(res, 404, 'Route not found');
}

function handleStatus(res: http.ServerResponse, engine: MemoryEngine | null): void {
  if (!engine) { sendError(res, 503, 'Memory not initialized'); return; }
  const stats = engine.getStats();
  const tierMap: Record<string, number> = {};
  for (const t of stats.tierBreakdown) tierMap[t.tier] = t.entryCount;
  sendJson(res, {
    totalEntries: stats.totalEntries,
    totalEdges: stats.totalEdges,
    totalVectors: stats.totalVectors,
    tierBreakdown: tierMap,
  });
}

function handleSearch(url: URL, res: http.ServerResponse, engine: MemoryEngine | null): void {
  if (!engine) { sendError(res, 503, 'Memory not initialized'); return; }
  const query = url.searchParams.get('q') ?? '';
  const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);
  const tier = url.searchParams.get('tier');
  const results = tier
    ? engine.search.searchInTier(query, tier, limit)
    : engine.search.search(query, limit);
  sendJson(res, results.map(r => toEntryResponse(r.entry, r.score)));
}

function handleListEntries(url: URL, res: http.ServerResponse, engine: MemoryEngine | null): void {
  if (!engine) { sendError(res, 503, 'Memory not initialized'); return; }
  const tier = url.searchParams.get('tier') ?? undefined;
  const type = url.searchParams.get('type') ?? undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const sort = url.searchParams.get('sort') ?? 'created_at';
  const afterId = url.searchParams.get('after_id');
  const entries = engine.knowledge.findFiltered(tier, type, limit, offset, sort, afterId ? parseInt(afterId, 10) : undefined);
  sendJson(res, entries.map(e => toEntryResponse(e)));
}

function handleGetEntry(path: string, res: http.ServerResponse, engine: MemoryEngine | null): void {
  if (!engine) { sendError(res, 503, 'Memory not initialized'); return; }
  const id = parseInt(path.split('/')[2], 10);
  if (isNaN(id)) { sendError(res, 400, 'Invalid id'); return; }
  const entry = engine.knowledge.findById(id);
  if (!entry) { sendError(res, 404, 'Not found'); return; }
  engine.knowledge.recordAccess(id);
  sendJson(res, toDetailResponse(entry));
}

function handleNeighbors(
  path: string, res: http.ServerResponse,
  engine: MemoryEngine | null, graph: KnowledgeGraph | null
): void {
  if (!engine || !graph) { sendError(res, 503, 'Not initialized'); return; }
  const id = parseInt(path.split('/')[2], 10);
  if (isNaN(id)) { sendError(res, 400, 'Invalid id'); return; }
  const neighborIds = graph.getConnected(id);
  const entries = [...neighborIds]
    .map(nid => engine.knowledge.findById(nid))
    .filter((e): e is KnowledgeEntry => e !== undefined);
  sendJson(res, entries.map(e => toEntryResponse(e)));
}

function handleGraphData(
  url: URL, res: http.ServerResponse,
  engine: MemoryEngine | null, graph: KnowledgeGraph | null
): void {
  if (!engine || !graph) { sendError(res, 503, 'Not initialized'); return; }
  const stats = engine.getStats();
  if (stats.totalEdges === 0) {
    const entries = engine.knowledge.findByTier('WORKING', 50);
    const nodes = entries.map(e => toGraphNode(e));
    sendJson(res, { nodes, edges: [] });
    return;
  }
  const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
  const edges = engine.graphRepo.findAll(limit);
  const nodeIds = [...new Set(edges.flatMap(e => [e.source_id, e.target_id]))];
  const nodes = nodeIds
    .map(id => engine.knowledge.findById(id))
    .filter((e): e is KnowledgeEntry => e !== undefined)
    .map(e => toGraphNode(e));
  const edgeList = edges.map(e => ({ source: e.source_id, target: e.target_id, relation: e.relation }));
  sendJson(res, { nodes, edges: edgeList });
}

function handleSessions(url: URL, res: http.ServerResponse, engine: MemoryEngine | null): void {
  if (!engine) { sendError(res, 503, 'Memory not initialized'); return; }
  const agent = url.searchParams.get('agent') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const sessions = engine.sessions.listFiltered(agent, status, limit);
  sendJson(res, sessions.map(s => ({
    id: s.session_id, agentName: s.agent_name,
    startedAt: s.started_at, endedAt: s.ended_at,
    observationCount: s.observation_count, status: s.status,
  })));
}

function handleSessionEvents(
  path: string, url: URL, res: http.ServerResponse, engine: MemoryEngine | null
): void {
  if (!engine) { sendError(res, 503, 'Memory not initialized'); return; }
  const sessionId = path.split('/')[2];
  const limit = parseInt(url.searchParams.get('limit') ?? '200', 10);
  const events = engine.audit.listBySession(sessionId, limit);
  sendJson(res, events.map(e => ({
    id: e.id, operation: e.operation,
    entryId: e.entry_id, sessionId: e.session_id,
    details: e.details, createdAt: e.created_at,
  })));
}

/** Map entry to API response (without content). */
function toEntryResponse(e: KnowledgeEntry, score = 0) {
  return {
    id: e.id, summary: e.summary, type: e.type, tier: e.tier,
    confidence: e.confidence, accessCount: e.access_count,
    source: e.source, tags: e.tags, score,
  };
}

/** Map entry to detail response (with content). */
function toDetailResponse(e: KnowledgeEntry) {
  return {
    id: e.id, summary: e.summary, content: e.content,
    type: e.type, tier: e.tier, confidence: e.confidence,
    accessCount: e.access_count, source: e.source, tags: e.tags,
  };
}

/** Map entry to graph node response. */
function toGraphNode(e: KnowledgeEntry) {
  return { id: e.id, summary: e.summary.substring(0, 60), type: e.type, tier: e.tier, source: e.source };
}

function sendJson(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, code: number, message: string): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}
