"use strict";
/**
 * MemoryToolDispatcher — routes mem_* tool calls to handlers.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryToolDispatcher = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ingest_pipeline_js_1 = require("./ingest-pipeline.js");
const hybrid_search_js_1 = require("./hybrid-search.js");
const tier_consolidator_js_1 = require("./tier-consolidator.js");
const sync_code_js_1 = require("./sync-code.js");
const quality_gate_js_1 = require("./v2/quality-gate.js");
const agent_scope_filter_js_1 = require("./v2/agent-scope-filter.js");
const token_budget_js_1 = require("./v2/token-budget.js");
const working_tier_expiry_js_1 = require("./v2/working-tier-expiry.js");
class MemoryToolDispatcher {
    engine;
    pipeline;
    hybridSearch;
    consolidator;
    workspace;
    syncCode = null;
    queryLayer = null;
    constructor(engine, workspace, embeddingService = null, queryLayer = null) {
        this.engine = engine;
        this.workspace = workspace;
        this.pipeline = new ingest_pipeline_js_1.IngestPipeline(engine.knowledge, embeddingService);
        this.pipeline.setEntityRepo(engine.entities);
        this.hybridSearch = new hybrid_search_js_1.HybridSearch(engine.search, engine.graph);
        this.hybridSearch.setCoreMemory(engine.coreMemory);
        this.consolidator = new tier_consolidator_js_1.TierConsolidator(engine.knowledge, engine.consolidation);
        this.queryLayer = queryLayer;
        if (queryLayer) {
            this.syncCode = new sync_code_js_1.MemSyncCode(engine, queryLayer, engine.graph);
        }
        // Wire V2 classes (KSA-110 F4: Anti-Pattern Protection)
        const db = engine.db;
        const qualityGate = new quality_gate_js_1.QualityGate(db);
        const scopeFilter = new agent_scope_filter_js_1.AgentScopeFilter(db);
        const tokenBudget = new token_budget_js_1.TokenBudget();
        const workingExpiry = new working_tier_expiry_js_1.WorkingTierExpiry(db);
        this.pipeline.setQualityGate(qualityGate);
        this.hybridSearch.setScopeFilter(scopeFilter);
        this.hybridSearch.setTokenBudget(tokenBudget);
        this.hybridSearch.setWorkingExpiry(workingExpiry);
    }
    /** Dispatch a memory tool call. Returns null if not a memory tool. */
    dispatch(name, args) {
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
            case 'mem_sync_code': return this.handleSyncCode(args);
            default: return null;
        }
    }
    handleSearch(args) {
        const query = args.query;
        if (!query)
            return 'Error: query required';
        const params = {
            query,
            limit: args.limit ?? 10,
            tier: args.tier,
            type: args.type,
            bm25Weight: 0.6,
            graphWeight: 0.4,
        };
        const results = this.hybridSearch.search(params);
        this.engine.audit.log('SEARCH', undefined, this.engine.getSessionId() ?? undefined);
        this.logSearchAnalytics(query, results.length);
        this.recordAccessAndCitations(results);
        const pinnedContext = this.hybridSearch.getPinnedContext();
        const lines = [];
        if (pinnedContext)
            lines.push(pinnedContext, '');
        if (results.length === 0) {
            lines.push(`No knowledge found for "${query}"`);
            return lines.join('\n');
        }
        const detail = args.detail ?? false;
        lines.push(`Found ${results.length} results:\n`);
        for (const r of results) {
            lines.push(`[${r.entry.type}] ${r.entry.summary}`);
            lines.push(`  ID: ${r.entry.id} | Tier: ${r.entry.tier} | Score: ${r.score.toFixed(3)} | Source: ${r.entry.source ?? 'n/a'}`);
            if (detail)
                lines.push(`  Content: ${r.entry.content.slice(0, 500)}`);
            lines.push('');
        }
        if (!detail)
            lines.push('Tip: use detail=true for content, or mem_get(id) for full entry.');
        return lines.join('\n');
    }
    /** Log search to search_log + popular_queries for analytics page. */
    logSearchAnalytics(query, resultCount) {
        try {
            const db = this.engine.db;
            db.prepare('INSERT INTO search_log (query, result_count) VALUES (?, ?)').run(query, resultCount);
            db.prepare(`INSERT INTO popular_queries (query, hit_count, avg_results) VALUES (?, 1, ?)
         ON CONFLICT(query) DO UPDATE SET
         hit_count = hit_count + 1,
         avg_results = (avg_results * (hit_count - 1) + ?) / hit_count,
         last_searched = datetime('now')`).run(query, resultCount, resultCount);
        }
        catch { /* analytics must not break search */ }
    }
    /** Increment access_count and auto-cite entries from search results. */
    recordAccessAndCitations(results) {
        try {
            if (results.length === 0)
                return;
            const db = this.engine.db;
            const accessStmt = db.prepare('UPDATE knowledge_entries SET access_count = access_count + 1, last_accessed_at = datetime(\'now\') WHERE id = ?');
            const citeStmt = db.prepare('INSERT OR IGNORE INTO citations (entry_id, cited_by, context) VALUES (?, \'mem_search\', \'auto-cited from search results\')');
            for (const r of results) {
                accessStmt.run(r.entry.id);
                citeStmt.run(r.entry.id);
            }
        }
        catch { /* must not break search */ }
    }
    handleIngest(args) {
        const content = args.content;
        if (!content)
            return 'Error: content required';
        const type = args.type ?? 'CONTEXT';
        const source = args.source;
        const tags = args.tags ?? '';
        const summary = args.summary ?? content.slice(0, 120);
        const agentName = args.agent_name;
        const id = this.pipeline.ingestEntry(content, summary, type, source, tags);
        if (agentName) {
            try {
                this.engine.db.prepare('UPDATE knowledge_entries SET agent_name = ? WHERE id = ?').run(agentName, id);
            }
            catch { /* must not break ingest */ }
        }
        this.engine.audit.log('INGEST', id, this.engine.getSessionId() ?? undefined);
        this.autoOwnEntry(id, source);
        this.autoScoreEntry(id, content, tags);
        return `Knowledge entry created: id=${id}, type=${type}, tier=WORKING`;
    }
    /** Auto-set owner based on source field. */
    autoOwnEntry(id, source) {
        try {
            const owner = this.inferOwner(source);
            if (owner) {
                this.engine.db.prepare("UPDATE knowledge_entries SET owner = ? WHERE id = ? AND (owner IS NULL OR owner = '')").run(owner, id);
            }
        }
        catch { /* must not break ingest */ }
    }
    inferOwner(source) {
        if (!source)
            return 'system';
        const s = source.toLowerCase();
        if (['ba', 'brd', 'fsd'].some(k => s.includes(k)))
            return 'ba-agent';
        if (['sa', 'tdd', 'architect'].some(k => s.includes(k)))
            return 'sa-agent';
        if (['qa', 'stp', 'stc', 'test'].some(k => s.includes(k)))
            return 'qa-agent';
        if (['dev', 'implement', 'code'].some(k => s.includes(k)))
            return 'dev-agent';
        if (['devops', 'deploy', 'release'].some(k => s.includes(k)))
            return 'devops-agent';
        if (['security', 'audit'].some(k => s.includes(k)))
            return 'security-agent';
        if (['ui', 'design', 'wireframe'].some(k => s.includes(k)))
            return 'ui-agent';
        if (['sm', 'scrum'].some(k => s.includes(k)))
            return 'sm-agent';
        if (['ta', 'technical'].some(k => s.includes(k)))
            return 'ta-agent';
        if (['chat', 'user'].some(k => s.includes(k)))
            return 'user';
        if (['hook', 'tool-call'].some(k => s.includes(k)))
            return 'system';
        return 'system';
    }
    /** Auto-compute quality score for newly ingested entry. */
    autoScoreEntry(id, content, tags) {
        try {
            const lenScore = content.length > 500 ? 30 : content.length > 200 ? 20 : content.length > 50 ? 10 : 5;
            const tagScore = tags ? 20 : 0;
            const structScore = content.includes('\n') && (content.includes('#') || content.includes('-')) ? 20 : 10;
            const total = Math.min(lenScore + tagScore + structScore + 10, 100);
            this.engine.db.prepare('INSERT OR REPLACE INTO quality_scores (entry_id, total_score, dimensions, scored_at) VALUES (?, ?, \'{}\', datetime(\'now\'))').run(id, total);
        }
        catch { /* must not break ingest */ }
    }
    handleIngestFile(args) {
        const filePath = args.file_path;
        if (!filePath)
            return 'Error: file_path is required';
        const type = args.type ?? 'CONTEXT';
        const format = args.format ?? 'markdown';
        const resolved = this.resolvePath(filePath);
        if (!fs.existsSync(resolved))
            return `Error: file not found — ${resolved}`;
        const text = fs.readFileSync(resolved, 'utf-8');
        const result = format === 'markdown'
            ? this.pipeline.ingestMarkdown(text, filePath, type)
            : this.pipeline.ingestText(text, filePath, type);
        this.engine.audit.log('INGEST_FILE', undefined, this.engine.getSessionId() ?? undefined);
        return `Ingested: ${result.entriesCreated} entries from ${filePath}`;
    }
    handleGet(args) {
        const id = args.id;
        if (!id)
            return 'Error: id required';
        const entry = this.engine.knowledge.findById(id);
        if (!entry)
            return `Entry not found: ${id}`;
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
    handleDelete(args) {
        const id = args.id;
        if (!id)
            return 'Error: id required';
        const existing = this.engine.knowledge.findById(id);
        if (!existing)
            return `Entry not found: ${id}`;
        this.engine.knowledge.delete(id);
        this.engine.audit.log('DELETE', id, this.engine.getSessionId() ?? undefined);
        return `Deleted entry #${id}: ${existing.summary.slice(0, 80)}`;
    }
    handleList(args) {
        const tier = args.tier;
        const type = args.type;
        const limit = args.limit ?? 20;
        const entries = tier
            ? this.engine.knowledge.findByTier(tier, limit)
            : type
                ? this.engine.knowledge.findByType(type, limit)
                : this.engine.knowledge.findByTier('WORKING', limit);
        if (entries.length === 0)
            return 'No entries found';
        const lines = [`${entries.length} entries:\n`];
        for (const e of entries) {
            lines.push(`#${e.id} [${e.type}] ${e.summary.slice(0, 80)}`);
            lines.push(`   Tier: ${e.tier} | Confidence: ${e.confidence} | Access: ${e.access_count}`);
        }
        return lines.join('\n');
    }
    handleGraph(args) {
        const action = args.action ?? 'neighbors';
        switch (action) {
            case 'neighbors': return this.graphNeighbors(args);
            case 'add_edge': return this.graphAddEdge(args);
            case 'path': return this.graphPath(args);
            case 'ego': return this.graphEgo(args);
            case 'all_edges': return this.graphAllEdges(args);
            case 'graph_data': return this.graphData(args);
            default: return `Unknown action: ${action}`;
        }
    }
    graphNeighbors(args) {
        const nodeId = args.node_id;
        if (!nodeId)
            return 'Error: node_id required';
        const neighbors = this.engine.graph.getConnected(nodeId);
        if (neighbors.size === 0)
            return `Node ${nodeId} has no connections`;
        const lines = [`Node ${nodeId} connections (${neighbors.size}):\n`];
        for (const nId of [...neighbors].slice(0, 20)) {
            const entry = this.engine.knowledge.findById(nId);
            lines.push(`  → [${nId}] ${entry?.summary ?? 'unknown'}`);
        }
        return lines.join('\n');
    }
    graphAddEdge(args) {
        const sourceId = args.source_id;
        const targetId = args.target_id;
        if (!sourceId || !targetId)
            return 'Error: source_id and target_id required';
        const relation = args.relation ?? 'RELATES_TO';
        const id = this.engine.graph.addEdge({ source_id: sourceId, target_id: targetId, relation });
        return `Edge created: ${sourceId} --[${relation}]--> ${targetId} (id=${id})`;
    }
    graphPath(args) {
        const fromId = args.from_id;
        const toId = args.to_id;
        if (!fromId || !toId)
            return 'Error: from_id and to_id required';
        const p = this.engine.graph.shortestPath(fromId, toId);
        if (!p)
            return `No path found between ${fromId} and ${toId}`;
        return `Path: ${p.join(' → ')}`;
    }
    graphEgo(args) {
        const nodeId = args.node_id;
        if (!nodeId)
            return 'Error: node_id required';
        const radius = args.radius ?? 2;
        const nodes = this.engine.graph.egoGraph(nodeId, radius);
        return `Ego graph for ${nodeId} (radius=${radius}): ${nodes.size} nodes\n${[...nodes].join(', ')}`;
    }
    graphAllEdges(args) {
        const limit = args.limit ?? 5000;
        const edges = this.engine.graphRepo.findAll(limit);
        return JSON.stringify(edges.map(e => ({ source_id: e.source_id, target_id: e.target_id, relation: e.relation })));
    }
    graphData(args) {
        const limit = args.limit ?? 15000;
        const edges = this.engine.graphRepo.findAll(limit);
        // Collect node IDs from edges
        const nodeIds = new Set();
        edges.forEach(e => { nodeIds.add(e.source_id); nodeIds.add(e.target_id); });
        // Also include ALL entries (isolated nodes too) up to limit
        const allEntries = this.engine.db.prepare(
            'SELECT id, summary, type, tier, source FROM knowledge_entries ORDER BY updated_at DESC LIMIT ?'
        ).all(limit);
        // Build nodes: start with all entries, edge-connected ones already included
        const nodes = [];
        const seenIds = new Set();
        for (const entry of allEntries) {
            if (!seenIds.has(entry.id)) {
                seenIds.add(entry.id);
                nodes.push({ id: entry.id, summary: (entry.summary || '').substring(0, 80), type: entry.type || 'CONTEXT', tier: entry.tier || 'WORKING', source: entry.source || '' });
            }
        }
        // Add any edge-connected nodes not yet in the list
        for (const nid of nodeIds) {
            if (!seenIds.has(nid)) {
                const entry = this.engine.knowledge.findById(nid);
                if (entry) {
                    seenIds.add(nid);
                    nodes.push({ id: entry.id, summary: (entry.summary || '').substring(0, 80), type: entry.type || 'CONTEXT', tier: entry.tier || 'WORKING', source: entry.source || '' });
                }
            }
        }
        const edgeList = edges.map(e => ({ source: e.source_id, target: e.target_id, relation: e.relation }));
        return JSON.stringify({ nodes, edges: edgeList });
    }
    handleStatus() {
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
        if (stats.tierBreakdown.length === 0)
            lines.push('  (empty)');
        return lines.join('\n');
    }
    handleConsolidate() {
        const result = this.consolidator.consolidate();
        this.engine.audit.log('CONSOLIDATE', undefined, this.engine.getSessionId() ?? undefined);
        return [
            'Consolidation complete:',
            `  Promoted: ${result.promoted}`,
            `  Demoted: ${result.demoted}`,
            `  Expired: ${result.expired}`,
        ].join('\n');
    }
    handleAudit(args) {
        const limit = args.limit ?? 20;
        const operation = args.operation;
        const entries = this.engine.audit.listRecent(limit, operation);
        if (entries.length === 0)
            return 'No audit entries found.';
        const lines = [`Recent audit entries (${entries.length}):\n`];
        for (const e of entries) {
            lines.push(`[${e.operation}] ${e.created_at}`);
            lines.push(`  Entry: ${e.entry_id ?? 'n/a'} | Session: ${e.session_id ?? 'n/a'}`);
            if (e.details)
                lines.push(`  Details: ${e.details.slice(0, 120)}`);
            lines.push('');
        }
        return lines.join('\n');
    }
    handleSessions(args) {
        const limit = args.limit ?? 20;
        const sessions = this.engine.sessions.listRecent(limit);
        if (sessions.length === 0)
            return 'No sessions found.';
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
    handleSyncCode(args) {
        if (!this.syncCode)
            return '{"error": "mem_sync_code requires queryLayer (code indexer not available)"}';
        return this.syncCode.execute(args);
    }
    resolvePath(filePath) {
        if (path.isAbsolute(filePath) && fs.existsSync(filePath))
            return filePath;
        if (this.workspace) {
            const wsPath = path.resolve(this.workspace, filePath);
            if (fs.existsSync(wsPath))
                return wsPath;
        }
        return path.resolve(filePath);
    }
}
exports.MemoryToolDispatcher = MemoryToolDispatcher;
//# sourceMappingURL=tool-dispatcher.js.map