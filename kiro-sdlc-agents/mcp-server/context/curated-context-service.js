"use strict";
/**
 * KSA-160: Curated Context Service — NL query → parallel search → RRF merge → budget allocation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuratedContextService = void 0;
const query_analyzer_js_1 = require("./query-analyzer.js");
const rrf_merger_js_1 = require("./rrf-merger.js");
const budget_allocator_js_1 = require("./budget-allocator.js");
class CuratedContextService {
    analyzer;
    merger;
    allocator;
    db;
    queryLayer;
    traverser;
    resolver;
    constructor(db, queryLayer, traverser, resolver) {
        this.analyzer = new query_analyzer_js_1.QueryAnalyzer();
        this.merger = new rrf_merger_js_1.RRFMerger();
        this.allocator = new budget_allocator_js_1.BudgetAllocator();
        this.db = db;
        this.queryLayer = queryLayer;
        this.traverser = traverser;
        this.resolver = resolver;
    }
    /** Execute curated context search with NL query. */
    async getContext(params) {
        const startTime = Date.now();
        const { query, max_tokens = 4000, include_source = true, include_memory = true, include_graph = true, source_weights } = params;
        // 1. Analyze query
        const analysis = this.analyzer.analyze(query);
        // 2. Parallel search
        const [codeResults, memoryResults] = await Promise.all([
            include_source ? this.searchCode(analysis) : Promise.resolve({ source: 'code', results: [] }),
            include_memory ? this.searchMemory(analysis) : Promise.resolve({ source: 'memory', results: [] })
        ]);
        // 3. Graph expansion (depends on code results)
        let graphResults = { source: 'graph', results: [] };
        if (include_graph && codeResults.results.length > 0) {
            graphResults = await this.expandGraph(codeResults.results.slice(0, 5));
        }
        // 4. Merge with RRF
        const merged = this.merger.merge({ code: codeResults, memory: memoryResults, graph: graphResults }, source_weights);
        // 5. Allocate token budget
        const allocated = this.allocator.allocate(merged, max_tokens);
        // 6. Format response
        const sections = this.formatSections(allocated);
        const tokensUsed = allocated.reduce((sum, r) => sum + r.tokens, 0) + 100;
        return {
            query,
            sections,
            metadata: {
                tokens_used: tokensUsed,
                tokens_budget: max_tokens,
                sources_queried: [
                    ...(include_source ? ['code'] : []),
                    ...(include_memory ? ['memory'] : []),
                    ...(include_graph ? ['graph'] : [])
                ],
                total_candidates: codeResults.results.length + memoryResults.results.length + graphResults.results.length,
                results_returned: allocated.length,
                execution_time_ms: Date.now() - startTime
            }
        };
    }
    async searchCode(analysis) {
        try {
            const ftsResults = this.queryLayer.searchCode(analysis.ftsQuery, 30);
            // Also try direct symbol resolution for candidates
            const symbolResults = [];
            for (const candidate of analysis.symbolCandidates.slice(0, 5)) {
                const resolved = this.resolver.resolve(candidate);
                for (const sym of resolved.slice(0, 3)) {
                    symbolResults.push({
                        id: sym.id,
                        name: sym.name,
                        kind: sym.kind,
                        file: sym.filePath,
                        line: sym.line,
                        signature: null
                    });
                }
            }
            // Combine FTS + symbol results (mini-RRF)
            const combined = this.miniRRF(ftsResults.map(r => ({
                id: undefined,
                name: r.name,
                kind: r.kind,
                file: r.filePath,
                line: r.startLine,
                signature: r.signature,
                source_code: null
            })), symbolResults);
            return { source: 'code', results: combined.slice(0, 20) };
        }
        catch {
            return { source: 'code', results: [] };
        }
    }
    async searchMemory(analysis) {
        try {
            // Search memory/KB using FTS on knowledge entries
            const query = analysis.keywords.slice(0, 5).join(' ');
            const rows = this.db.prepare(`
        SELECT id, content, summary, type, tags, created_at
        FROM knowledge_entries
        WHERE id IN (
          SELECT rowid FROM knowledge_fts WHERE knowledge_fts MATCH ?
        )
        ORDER BY created_at DESC
        LIMIT 10
      `).all(query);
            return {
                source: 'memory',
                results: rows.map(r => ({
                    id: r.id,
                    name: r.summary || r.content?.substring(0, 50) || 'entry',
                    kind: r.type || 'memory',
                    content: r.summary || r.content?.substring(0, 200),
                    file: undefined,
                    line: undefined
                }))
            };
        }
        catch {
            // KB tables may not exist
            return { source: 'memory', results: [] };
        }
    }
    async expandGraph(topSymbols) {
        const expanded = [];
        const seen = new Set();
        for (const symbol of topSymbols) {
            try {
                const startNode = this.traverser.resolveNode(symbol.name);
                if (!startNode)
                    continue;
                const results = this.traverser.traverse(startNode, {
                    edgeTypes: ['calls', 'imports', 'inherits'],
                    nodeTypes: [],
                    direction: 'both',
                    maxDepth: 1,
                    maxResults: 5
                });
                for (const r of results) {
                    const key = `${r.node.name}:${r.node.filePath}`;
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    expanded.push({
                        id: r.node.id,
                        name: r.node.name,
                        kind: r.node.kind,
                        file: r.node.filePath,
                        line: r.node.startLine,
                        relationship: `${r.edgeType} ${symbol.name}`
                    });
                }
            }
            catch {
                // Skip if symbol not in graph
            }
        }
        return { source: 'graph', results: expanded };
    }
    miniRRF(listA, listB) {
        const k = 60;
        const scores = new Map();
        for (let i = 0; i < listA.length; i++) {
            const key = listA[i].name + ':' + (listA[i].file || '');
            scores.set(key, { score: 1 / (k + i), item: listA[i] });
        }
        for (let i = 0; i < listB.length; i++) {
            const key = listB[i].name + ':' + (listB[i].file || '');
            if (scores.has(key)) {
                scores.get(key).score += 1 / (k + i);
            }
            else {
                scores.set(key, { score: 1 / (k + i), item: listB[i] });
            }
        }
        return Array.from(scores.values())
            .sort((a, b) => b.score - a.score)
            .map(e => e.item);
    }
    formatSections(allocated) {
        const bySource = new Map();
        for (const item of allocated) {
            const source = (item.sources?.[0] || 'code');
            if (!bySource.has(source))
                bySource.set(source, []);
            bySource.get(source).push({
                name: item.name,
                kind: item.kind,
                file: item.file,
                line: item.line,
                relevance: item.relevance_score,
                detail: item.detail,
                content: item.content,
                relationship: item.relationship
            });
        }
        const sections = [];
        const titleMap = {
            code: 'Code Symbols',
            memory: 'Knowledge Base',
            graph: 'Related (Graph)'
        };
        for (const [source, items] of bySource) {
            sections.push({
                title: titleMap[source] || source,
                source: source,
                items
            });
        }
        return sections;
    }
}
exports.CuratedContextService = CuratedContextService;
//# sourceMappingURL=curated-context-service.js.map