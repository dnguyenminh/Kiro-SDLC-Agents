/**
 * MemoryToolDispatcher — routes mem_* tool calls to handlers.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MemoryEngine } from './memory-engine.js';
import { IngestPipeline } from './ingest-pipeline.js';
import { HybridSearch, SearchParams } from './hybrid-search.js';
import { TierConsolidator } from './tier-consolidator.js';
import { EmbeddingService } from './embedding/index.js';

export class MemoryToolDispatcher {
  private readonly engine: MemoryEngine;
  private readonly pipeline: IngestPipeline;
  private readonly hybridSearch: HybridSearch;
  private readonly consolidator: TierConsolidator;
  private readonly workspace: string;

  constructor(engine: MemoryEngine, workspace: string, embeddingService: EmbeddingService | null = null) {
    this.engine = engine;
    this.workspace = workspace;
    this.pipeline = new IngestPipeline(engine.knowledge, embeddingService);
    this.hybridSearch = new HybridSearch(engine.search, engine.graph);
    this.consolidator = new TierConsolidator(engine.knowledge, engine.consolidation);
  }

  /** Dispatch a memory tool call. Returns null if not a memory tool. */
  dispatch(name: string, args: Record<string, unknown>): string | null {
    switch (name) {
      case 'mem_search': return this.handleSearch(args);
      case 'mem_ingest': return this.handleIngest(args);
      case 'mem_ingest_file': return this.handleIngestFile(args);
      case 'mem_get': return this.handleGet(args);
      case 'mem_delete': return this.handleDelete(args);
      case 'mem_list': return this.handleList(args);
      case 'mem_graph': return this.handleGraph(args);
      case 'mem_status': return this.handleStatus();
      case 'mem_consolidate': return this.handleConsolidate();
      case 'mem_audit': return this.handleAudit(args);
      case 'mem_sessions': return this.handleSessions(args);
      default: return null;
    }
  }

  private handleSearch(args: Record<string, unknown>): string {
    const query = args.query as string;
    if (!query) return 'Error: query required';
    const params: SearchParams = {
      query,
      limit: (args.limit as number) ?? 10,
      tier: args.tier as string | undefined,
      type: args.type as string | undefined,
      bm25Weight: 0.6,
      graphWeight: 0.4,
    };
    const results = this.hybridSearch.search(params);
    this.engine.audit.log('SEARCH', undefined, this.engine.getSessionId() ?? undefined);
    if (results.length === 0) return `No knowledge found for "${query}"`;
    const detail = args.detail as boolean ?? false;
    const lines = [`Found ${results.length} results:\n`];
    for (const r of results) {
      lines.push(`[${r.entry.type}] ${r.entry.summary}`);
      lines.push(`  ID: ${r.entry.id} | Tier: ${r.entry.tier} | Score: ${r.score.toFixed(3)} | Source: ${r.entry.source ?? 'n/a'}`);
      if (detail) lines.push(`  Content: ${r.entry.content.slice(0, 500)}`);
      lines.push('');
    }
    if (!detail) lines.push('Tip: use detail=true for content, or mem_get(id) for full entry.');
    return lines.join('\n');
  }

  private handleIngest(args: Record<string, unknown>): string {
    const content = args.content as string;
    if (!content) return 'Error: content required';
    const type = (args.type as string) ?? 'CONTEXT';
    const source = args.source as string | undefined;
    const tags = (args.tags as string) ?? '';
    const summary = (args.summary as string) ?? content.slice(0, 120);
    const id = this.pipeline.ingestEntry(content, summary, type, source, tags);
    this.engine.audit.log('INGEST', id, this.engine.getSessionId() ?? undefined);
    return `Knowledge entry created: id=${id}, type=${type}, tier=WORKING`;
  }

  private handleIngestFile(args: Record<string, unknown>): string {
    const filePath = args.file_path as string;
    if (!filePath) return 'Error: file_path is required';
    const type = (args.type as string) ?? 'CONTEXT';
    const format = (args.format as string) ?? 'markdown';
    const resolved = this.resolvePath(filePath);
    if (!fs.existsSync(resolved)) return `Error: file not found — ${resolved}`;
    const text = fs.readFileSync(resolved, 'utf-8');
    const result = format === 'markdown'
      ? this.pipeline.ingestMarkdown(text, filePath, type)
      : this.pipeline.ingestText(text, filePath, type);
    this.engine.audit.log('INGEST_FILE', undefined, this.engine.getSessionId() ?? undefined);
    return `Ingested: ${result.entriesCreated} entries from ${filePath}`;
  }

  private handleGet(args: Record<string, unknown>): string {
    const id = args.id as number;
    if (!id) return 'Error: id required';
    const entry = this.engine.knowledge.findById(id);
    if (!entry) return `Entry not found: ${id}`;
    this.engine.knowledge.recordAccess(id);
    this.engine.audit.log('ACCESS', id, this.engine.getSessionId() ?? undefined);
    const lines = [
      `Knowledge Entry #${entry.id}:`,
      `  Summary: ${entry.summary}`,
      `  Type: ${entry.type}`,
      `  Tier: ${entry.tier}`,
      `  Confidence: ${entry.confidence}`,
      `  Access count: ${entry.access_count + 1}`,
      `  Source: ${entry.source ?? 'n/a'}`,
      `  Tags: ${entry.tags}`,
      `  Created: ${entry.created_at}`,
      `  Content:`,
      entry.content,
    ];
    return lines.join('\n');
  }

  private handleDelete(args: Record<string, unknown>): string {
    const id = args.id as number;
    if (!id) return 'Error: id required';
    const existing = this.engine.knowledge.findById(id);
    if (!existing) return `Entry not found: ${id}`;
    this.engine.knowledge.delete(id);
    this.engine.audit.log('DELETE', id, this.engine.getSessionId() ?? undefined);
    return `Deleted entry #${id}: ${existing.summary.slice(0, 80)}`;
  }

  private handleList(args: Record<string, unknown>): string {
    const tier = args.tier as string | undefined;
    const type = args.type as string | undefined;
    const limit = (args.limit as number) ?? 20;
    const entries = tier
      ? this.engine.knowledge.findByTier(tier, limit)
      : type
        ? this.engine.knowledge.findByType(type, limit)
        : this.engine.knowledge.findByTier('WORKING', limit);
    if (entries.length === 0) return 'No entries found';
    const lines = [`${entries.length} entries:\n`];
    for (const e of entries) {
      lines.push(`#${e.id} [${e.type}] ${e.summary.slice(0, 80)}`);
      lines.push(`   Tier: ${e.tier} | Confidence: ${e.confidence} | Access: ${e.access_count}`);
    }
    return lines.join('\n');
  }

  private handleGraph(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'neighbors';
    switch (action) {
      case 'neighbors': return this.graphNeighbors(args);
      case 'add_edge': return this.graphAddEdge(args);
      case 'path': return this.graphPath(args);
      case 'ego': return this.graphEgo(args);
      default: return `Unknown action: ${action}`;
    }
  }

  private graphNeighbors(args: Record<string, unknown>): string {
    const nodeId = args.node_id as number;
    if (!nodeId) return 'Error: node_id required';
    const neighbors = this.engine.graph.getConnected(nodeId);
    if (neighbors.size === 0) return `Node ${nodeId} has no connections`;
    const lines = [`Node ${nodeId} connections (${neighbors.size}):\n`];
    for (const nId of [...neighbors].slice(0, 20)) {
      const entry = this.engine.knowledge.findById(nId);
      lines.push(`  → [${nId}] ${entry?.summary ?? 'unknown'}`);
    }
    return lines.join('\n');
  }

  private graphAddEdge(args: Record<string, unknown>): string {
    const sourceId = args.source_id as number;
    const targetId = args.target_id as number;
    if (!sourceId || !targetId) return 'Error: source_id and target_id required';
    const relation = (args.relation as string) ?? 'RELATES_TO';
    const id = this.engine.graph.addEdge({ source_id: sourceId, target_id: targetId, relation });
    return `Edge created: ${sourceId} --[${relation}]--> ${targetId} (id=${id})`;
  }

  private graphPath(args: Record<string, unknown>): string {
    const fromId = args.from_id as number;
    const toId = args.to_id as number;
    if (!fromId || !toId) return 'Error: from_id and to_id required';
    const p = this.engine.graph.shortestPath(fromId, toId);
    if (!p) return `No path found between ${fromId} and ${toId}`;
    return `Path: ${p.join(' → ')}`;
  }

  private graphEgo(args: Record<string, unknown>): string {
    const nodeId = args.node_id as number;
    if (!nodeId) return 'Error: node_id required';
    const radius = (args.radius as number) ?? 2;
    const nodes = this.engine.graph.egoGraph(nodeId, radius);
    return `Ego graph for ${nodeId} (radius=${radius}): ${nodes.size} nodes\n${[...nodes].join(', ')}`;
  }

  private handleStatus(): string {
    const stats = this.engine.getStats();
    const lines = [
      'Memory Engine Status:',
      `  Total entries: ${stats.totalEntries}`,
      `  Total edges: ${stats.totalEdges}`,
      `  Total vectors: ${stats.totalVectors}`,
      '',
      'Tier Breakdown:',
    ];
    for (const ts of stats.tierBreakdown) {
      lines.push(`  ${ts.tier}: ${ts.entryCount} entries (avg confidence: ${ts.avgConfidence.toFixed(2)}, avg access: ${ts.avgAccessCount.toFixed(1)})`);
    }
    if (stats.tierBreakdown.length === 0) lines.push('  (empty)');
    return lines.join('\n');
  }

  private handleConsolidate(): string {
    const result = this.consolidator.consolidate();
    this.engine.audit.log('CONSOLIDATE', undefined, this.engine.getSessionId() ?? undefined);
    return [
      'Consolidation complete:',
      `  Promoted: ${result.promoted}`,
      `  Demoted: ${result.demoted}`,
      `  Expired: ${result.expired}`,
    ].join('\n');
  }

  private handleAudit(args: Record<string, unknown>): string {
    const limit = (args.limit as number) ?? 20;
    const operation = args.operation as string | undefined;
    const entries = this.engine.audit.listRecent(limit, operation);
    if (entries.length === 0) return 'No audit entries found.';
    const lines = [`Recent audit entries (${entries.length}):\n`];
    for (const e of entries) {
      lines.push(`[${e.operation}] ${e.created_at}`);
      lines.push(`  Entry: ${e.entry_id ?? 'n/a'} | Session: ${e.session_id ?? 'n/a'}`);
      if (e.details) lines.push(`  Details: ${e.details.slice(0, 120)}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  private handleSessions(args: Record<string, unknown>): string {
    const limit = (args.limit as number) ?? 20;
    const sessions = this.engine.sessions.listRecent(limit);
    if (sessions.length === 0) return 'No sessions found.';
    const active = this.engine.sessions.activeCount();
    const lines = [`Sessions (active: ${active}, showing ${sessions.length}):\n`];
    for (const s of sessions) {
      const duration = s.ended_at ? `ended ${s.ended_at}` : 'active';
      lines.push(`[${s.session_id}] ${s.status} | Agent: ${s.agent_name ?? 'unknown'}`);
      lines.push(`  Started: ${s.started_at} | ${duration} | Observations: ${s.observation_count}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) return filePath;
    if (this.workspace) {
      const wsPath = path.resolve(this.workspace, filePath);
      if (fs.existsSync(wsPath)) return wsPath;
    }
    return path.resolve(filePath);
  }
}
