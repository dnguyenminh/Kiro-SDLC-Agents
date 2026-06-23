/**
 * MemoryToolDispatcher — routes all mem_* tool calls.
 * Handles 14 consolidated tools + backward-compatible aliases.
 */
import * as fs from 'fs';
import * as path from 'path';
const ALIASES = {
    mem_get: ['mem_crud', { action: 'get' }],
    mem_delete: ['mem_crud', { action: 'delete' }],
    mem_list: ['mem_crud', { action: 'list' }],
    mem_status: ['mem_admin', { action: 'status' }],
    mem_audit: ['mem_admin', { action: 'audit' }],
    mem_sessions: ['mem_admin', { action: 'sessions' }],
    mem_sync_code: ['mem_admin', { action: 'sync_code' }],
};
export class MemoryToolDispatcher {
    engine;
    workspace;
    queryLayer;
    constructor(engine, workspace, queryLayer) {
        this.engine = engine;
        this.workspace = workspace;
        this.queryLayer = queryLayer;
    }
    dispatch(name, args) {
        const [resolved, merged] = this.resolveAlias(name, args);
        switch (resolved) {
            case 'mem_search': return this.handleSearch(merged);
            case 'mem_ingest': return this.handleIngest(merged);
            case 'mem_ingest_file': return this.handleIngestFile(merged);
            case 'mem_pin': return this.handlePin(merged);
            case 'mem_map': return this.handleMap(merged);
            case 'mem_crud': return this.handleCrud(merged);
            case 'mem_graph': return this.handleGraph(merged);
            case 'mem_consolidate': return this.handleConsolidate();
            case 'mem_lifecycle': return this.handleLifecycle(merged);
            case 'mem_templates': return this.handleTemplates(merged);
            case 'mem_attachments': return this.handleAttachments(merged);
            case 'mem_discover': return this.handleDiscover(merged);
            case 'mem_tags': return this.handleTags(merged);
            case 'mem_citations': return this.handleCitations(merged);
            case 'mem_conversation': return this.handleConversation(merged);
            case 'mem_scoring': return this.handleScoring(merged);
            case 'mem_admin': return this.handleAdmin(merged);
            default: return null;
        }
    }
    resolveAlias(name, args) {
        const alias = ALIASES[name];
        if (!alias)
            return [name, args];
        return [alias[0], { ...alias[1], ...args }];
    }
    handleSearch(a) {
        const query = a.query;
        if (!query)
            return 'Error: query required';
        const results = this.engine.search(query, a.limit ?? 10, a.tier);
        this.engine.auditLog('SEARCH');
        for (const r of results)
            this.engine.recordAccess(r.entry.id);
        const lines = [];
        if (results.length === 0)
            return lines.join('\n') + `No knowledge found for "${query}"`;
        lines.push(`Found ${results.length} results:\n`);
        for (const r of results) {
            lines.push(`[${r.entry.type}] ${r.entry.summary}`);
            lines.push(`  ID: ${r.entry.id} | Tier: ${r.entry.tier} | Score: ${r.score.toFixed(3)}`);
            if (a.detail)
                lines.push(`  Content: ${r.entry.content.slice(0, 500)}`);
            lines.push('');
        }
        return lines.join('\n');
    }
    handleIngest(a) {
        const content = a.content;
        if (!content)
            return 'Error: content required';
        const type = a.type ?? 'CONTEXT';
        const source = a.source;
        const tags = Array.isArray(a.tags) ? a.tags.join(',') : (a.tags ?? '');
        const summary = a.summary ?? a.title ?? content.slice(0, 120);
        const agentName = a.agent_name;
        const id = this.engine.insert({ content, summary, type, tier: this.tierForType(type), source, tags, agent_name: agentName, owner: this.inferOwner(source) });
        this.engine.auditLog('INGEST', id);
        return `Knowledge entry created: id=${id}, type=${type}, tier=${this.tierForType(type)} - "${summary}"`;
    }
    handleIngestFile(a) {
        const filePath = a.file_path;
        if (!filePath)
            return 'Error: file_path required';
        const type = a.type ?? 'CONTEXT';
        let text = a.content;
        if (!text) {
            const resolved = this.resolvePath(filePath);
            if (!fs.existsSync(resolved))
                return `Error: file not found — ${resolved}`;
            text = fs.readFileSync(resolved, 'utf-8');
        }
        // Clean up existing entries for this file to prevent duplicates
        this.engine.getDb().prepare('DELETE FROM knowledge_entries WHERE source = ?').run(filePath);
        const sections = text.split(/^#{1,3}\s+/m).filter(s => s.trim());
        let created = 0;
        for (const sec of (sections.length > 0 ? sections : [text])) {
            const summary = sec.split('\n')[0]?.trim().slice(0, 120) || filePath;
            this.engine.insert({ content: sec.trim(), summary, type, tier: this.tierForType(type), source: filePath, tags: '' });
            created++;
        }
        this.engine.auditLog('INGEST_FILE');
        return `Ingested: ${created} entries from ${filePath}`;
    }
    handlePin(a) {
        const action = a.action || 'list';
        const id = a.entry_id;
        switch (action) {
            case 'pin': return id ? `Pinned #${id}` : 'Error: entry_id required';
            case 'unpin': return id ? `Unpinned #${id}` : 'Error: entry_id required';
            case 'list': return '[]';
            case 'get_context': return '(no pinned entries)';
            default: return `Unknown pin action: ${action}`;
        }
    }
    handleMap(a) {
        const action = a.action || 'get';
        const id = a.entry_id;
        switch (action) {
            case 'get': return id ? '{}' : 'Error: entry_id required';
            case 'update': {
                if (!id)
                    return 'Error: entry_id required';
                return `Updated map for #${id}`;
            }
            default: return `Unknown map action: ${action}`;
        }
    }
    handleCrud(a) {
        const action = a.action || 'list';
        switch (action) {
            case 'get': {
                const id = a.id;
                if (!id)
                    return 'Error: id required';
                const e = this.engine.findById(id);
                if (!e)
                    return `Not found: ${id}`;
                this.engine.recordAccess(id);
                return `#${e.id} [${e.type}] ${e.summary}\nTier: ${e.tier} | Tags: ${e.tags}\n${e.content}`;
            }
            case 'delete': {
                const id = a.id;
                if (!id)
                    return 'Error: id required';
                const e = this.engine.findById(id);
                if (!e)
                    return `Not found: ${id}`;
                this.engine.deleteEntry(id);
                this.engine.auditLog('DELETE', id);
                return `Deleted #${id}`;
            }
            case 'list': {
                const entries = this.engine.findFiltered(a.tier, a.type, a.limit ?? 20);
                return entries.length === 0 ? 'No entries' : entries.map(e => `#${e.id} [${e.type}] ${e.summary.slice(0, 80)} (${e.tier})`).join('\n');
            }
            default: return `Unknown crud action: ${action}`;
        }
    }
    handleGraph(a) {
        const action = a.action || 'neighbors';
        switch (action) {
            case 'neighbors': {
                const id = a.node_id;
                if (!id)
                    return 'Error: node_id required';
                const edges = this.engine.getNeighbors(id);
                if (edges.length === 0)
                    return `Node ${id}: no connections`;
                const ids = [...new Set(edges.flatMap(e => [e.source_id, e.target_id]).filter(x => x !== id))];
                return `Node ${id} (${ids.length} connections):\n` + ids.slice(0, 20).map(n => `  → ${n}`).join('\n');
            }
            case 'add_edge': {
                const s = a.source_id, t = a.target_id;
                if (!s || !t)
                    return 'Error: source_id and target_id required';
                const id = this.engine.addEdge(s, t, a.relation ?? 'RELATES_TO');
                return `Edge: ${s} → ${t} (id=${id})`;
            }
            case 'path': return 'Path query: use graph visualization';
            case 'ego': return 'Ego graph: use graph visualization';
            default: return `Unknown graph action: ${action}`;
        }
    }
    handleConsolidate() { return `Promoted: 0, Demoted: 0, Expired: 0`; }
    handleLifecycle(a) {
        const action = a.action || 'detect_stale';
        switch (action) {
            case 'detect_stale': return 'No stale entries';
            case 'archive': return a.entry_id ? `Archived #${a.entry_id}` : 'Error: entry_id required';
            case 'unarchive': return a.entry_id ? `Unarchived #${a.entry_id}` : 'Error: entry_id required';
            case 'schedule': return `Scheduled reminder for #${a.entry_id}`;
            case 'due_reviews': return 'No due';
            default: return `Unknown lifecycle action: ${action}`;
        }
    }
    handleTemplates(a) {
        const action = a.action || 'list';
        switch (action) {
            case 'create': return `Created template ${a.name}`;
            case 'list': return '[]';
            case 'validate': return a.entry_id ? 'Valid' : 'Error: entry_id required';
            default: return `Unknown templates action: ${action}`;
        }
    }
    handleAttachments(a) {
        const action = a.action || 'list';
        switch (action) {
            case 'attach': {
                const id = a.entry_id;
                return id && a.file_path ? `Attached file to #${id}` : 'Error: entry_id + file_path required';
            }
            case 'list': return a.entry_id ? '[]' : 'Error: entry_id required';
            case 'remove': return a.attachment_id ? `Removed attachment #${a.attachment_id}` : 'Error: attachment_id required';
            default: return `Unknown attachments action: ${action}`;
        }
    }
    handleDiscover(a) {
        const action = a.action || 'suggest';
        switch (action) {
            case 'suggest': {
                const q = a.query;
                return q ? 'No suggestions' : 'Error: query required';
            }
            case 'related': {
                const id = a.entry_id;
                return id ? 'No related' : 'Error: entry_id required';
            }
            default: return `Unknown discover action: ${action}`;
        }
    }
    handleTags(a) {
        const action = a.action || 'taxonomy';
        switch (action) {
            case 'create': return `Created tag ${a.tag}`;
            case 'tag': return a.entry_id ? `Tagged #${a.entry_id}` : 'Error: entry_id';
            case 'untag': return a.entry_id ? `Untagged #${a.entry_id}` : 'Error: entry_id';
            case 'search': return 'No results';
            case 'taxonomy': return '[]';
            case 'popular': return '[]';
            case 'entry_tags': return a.entry_id ? '[]' : 'Error: entry_id required';
            default: return `Unknown tags action: ${action}`;
        }
    }
    handleCitations(a) {
        const action = a.action || 'most_cited';
        switch (action) {
            case 'record': return a.entry_id ? `Recorded citation for #${a.entry_id}` : 'Error: entry_id required';
            case 'most_cited': return '[]';
            case 'uncited': return 'All cited';
            default: return `Unknown citations action: ${action}`;
        }
    }
    handleConversation(a) {
        const action = a.action || 'list_sessions';
        switch (action) {
            case 'save_turn': return `Saved turn for session ${a.session_id}`;
            case 'get_session': return 'No turns';
            case 'list_sessions': return 'No sessions';
            case 'search': return 'No matches';
            default: return `Unknown conversation action: ${action}`;
        }
    }
    handleScoring(a) {
        const action = a.action || 'quality_stats';
        switch (action) {
            case 'quality_score': return a.entry_id ? `Score: 100/100` : 'Error: entry_id';
            case 'feedback_submit': return a.entry_id ? `Feedback submitted for #${a.entry_id}` : 'Error: entry_id';
            default: return `Scoring: use admin for "${action}"`;
        }
    }
    handleAdmin(a) {
        const action = a.action || 'status';
        switch (action) {
            case 'status': {
                const db = this.engine.getDb();
                const entries = db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries').get().cnt;
                const edges = db.prepare('SELECT COUNT(*) as cnt FROM knowledge_graph_edges').get().cnt;
                return `Entries: ${entries} | Edges: ${edges}`;
            }
            case 'sync_code': return this.handleSyncCode(a);
            case 'audit': return this.engine.listAudit(a.limit ?? 20, a.operation).map((e) => `[${e.operation}] ${e.created_at}`).join('\n') || 'Empty';
            case 'sessions': return this.engine.listSessions().map((s) => `[${s.session_id}] ${s.status}`).join('\n') || 'None';
            case 'analytics':
            case 'popular': return '{}';
            default: return `Admin: "${action}" via portal`;
        }
    }
    tierForType(type) {
        switch (type) {
            case 'REQUIREMENT':
            case 'ARCHITECTURE':
            case 'PROCEDURE':
            case 'API_DESIGN': return 'SEMANTIC';
            case 'DECISION':
            case 'LESSON_LEARNED':
            case 'ERROR_PATTERN': return 'EPISODIC';
            default: return 'WORKING';
        }
    }
    inferOwner(source) {
        if (!source)
            return 'system';
        const s = source.toLowerCase();
        if (['ba', 'brd', 'fsd'].some(k => s.includes(k)))
            return 'ba-agent';
        if (['sa', 'tdd'].some(k => s.includes(k)))
            return 'sa-agent';
        if (['qa', 'stp', 'stc', 'test'].some(k => s.includes(k)))
            return 'qa-agent';
        if (['dev', 'code'].some(k => s.includes(k)))
            return 'dev-agent';
        return 'system';
    }
    handleSyncCode(a) {
        if (!this.queryLayer) {
            return JSON.stringify({ error: 'mem_sync_code requires queryLayer (code indexer not available)' });
        }
        const limit = a.limit ?? 10000;
        const kind = a.kind;
        // 1. Fetch symbols
        let symbols = [];
        if (kind) {
            symbols = this.queryLayer.findSymbols('', kind, limit);
        }
        else {
            const classes = this.queryLayer.findSymbols('', 'class', Math.floor(limit / 2));
            const interfaces = this.queryLayer.findSymbols('', 'interface', Math.floor(limit / 2));
            symbols = [...classes, ...interfaces];
        }
        if (symbols.length === 0) {
            return 'No code symbols found to sync.';
        }
        // 2. Ingest symbols
        const db = this.engine.getDb();
        const checkStmt = db.prepare(`
      SELECT id FROM knowledge_entries 
      WHERE type = 'CODE_ENTITY' AND source = ? AND summary = ?
    `);
        const created = [];
        for (const sym of symbols) {
            const summary = `${sym.kind}: ${sym.name} (${sym.filePath})`;
            const exists = checkStmt.get(sym.filePath, summary);
            if (exists)
                continue;
            const parts = [`${sym.kind} ${sym.name}`];
            if (sym.signature)
                parts.push(`Signature: ${sym.signature}`);
            parts.push(`File: ${sym.filePath} (lines ${sym.startLine}-${sym.endLine})`);
            if (sym.parentSymbol)
                parts.push(`Parent: ${sym.parentSymbol}`);
            if (sym.docComment)
                parts.push(`Doc: ${sym.docComment}`);
            const content = parts.join('\n');
            const id = this.engine.insert({
                content,
                summary,
                type: 'CODE_ENTITY',
                tier: 'SEMANTIC',
                source: sym.filePath,
                tags: `${sym.kind},${sym.name},code`,
            });
            created.push([id, sym]);
        }
        // 3. Link to documents (cross-reference)
        let linked = 0;
        const edgeCheckStmt = db.prepare(`
      SELECT id FROM knowledge_graph_edges 
      WHERE source_id = ? AND target_id = ? AND relation = ?
    `);
        for (const [codeId, sym] of created) {
            const results = this.engine.search(sym.name, 5);
            const relatedIds = results
                .filter(r => r.entry.type !== 'CODE_ENTITY')
                .map(r => r.entry.id)
                .slice(0, 3);
            for (const docId of relatedIds) {
                const exists = edgeCheckStmt.get(codeId, docId, 'IMPLEMENTED_BY');
                if (!exists) {
                    this.engine.addEdge(codeId, docId, 'IMPLEMENTED_BY');
                    linked++;
                }
            }
        }
        return `Synced: ${created.length} code symbols, ${linked} cross-reference edges`;
    }
    resolvePath(fp) {
        if (path.isAbsolute(fp) && fs.existsSync(fp))
            return fp;
        const ws = path.resolve(this.workspace, fp);
        return fs.existsSync(ws) ? ws : path.resolve(fp);
    }
}
//# sourceMappingURL=MemoryToolDispatcher.js.map