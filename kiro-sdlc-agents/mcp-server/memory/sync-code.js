"use strict";
/**
 * mem_sync_code — sync code symbols into memory graph with IMPLEMENTED_BY edges.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemSyncCode = void 0;
class MemSyncCode {
    engine;
    queryLayer;
    graph;
    constructor(engine, queryLayer, graph) {
        this.engine = engine;
        this.queryLayer = queryLayer;
        this.graph = graph;
    }
    /** Sync code symbols into memory graph. */
    execute(args) {
        const limit = args.limit ?? 10000;
        const kind = args.kind;
        const symbols = this.fetchSymbols(kind, limit);
        if (symbols.length === 0)
            return 'No code symbols found to sync.';
        const created = this.ingestSymbols(symbols);
        const linked = this.linkToDocuments(created);
        return `Synced: ${created.length} code symbols, ${linked} cross-reference edges`;
    }
    fetchSymbols(kind, limit) {
        if (kind)
            return this.queryLayer.findSymbols('', kind, limit);
        const classes = this.queryLayer.findSymbols('', 'class', Math.floor(limit / 2));
        const interfaces = this.queryLayer.findSymbols('', 'interface', Math.floor(limit / 2));
        return [...classes, ...interfaces];
    }
    ingestSymbols(symbols) {
        const results = [];
        for (const sym of symbols) {
            if (this.isAlreadyIngested(sym))
                continue;
            const id = this.createCodeEntry(sym);
            results.push([id, sym]);
        }
        return results;
    }
    isAlreadyIngested(sym) {
        const existing = this.engine.search.search(sym.name, 3);
        return existing.some((r) => r.entry.type === 'CODE_ENTITY' && r.entry.source === sym.filePath);
    }
    createCodeEntry(sym) {
        const content = this.buildContent(sym);
        const summary = `${sym.kind}: ${sym.name} (${sym.filePath})`;
        return this.engine.knowledge.insert({
            content, summary, type: 'CODE_ENTITY',
            tier: 'SEMANTIC', source: sym.filePath,
            tags: `${sym.kind},${sym.name},code`,
        });
    }
    buildContent(sym) {
        const parts = [`${sym.kind} ${sym.name}`];
        if (sym.signature)
            parts.push(`Signature: ${sym.signature}`);
        parts.push(`File: ${sym.filePath} (lines ${sym.startLine}-${sym.endLine})`);
        if (sym.parentSymbol)
            parts.push(`Parent: ${sym.parentSymbol}`);
        if (sym.docComment)
            parts.push(`Doc: ${sym.docComment}`);
        return parts.join('\n');
    }
    linkToDocuments(codeEntries) {
        let edgeCount = 0;
        for (const [codeId, sym] of codeEntries) {
            const related = this.findRelatedDocEntries(sym.name);
            for (const docId of related) {
                this.graph.addEdgeIfNotExists(codeId, docId, 'IMPLEMENTED_BY');
                edgeCount++;
            }
        }
        return edgeCount;
    }
    findRelatedDocEntries(symbolName) {
        const results = this.engine.search.search(symbolName, 5);
        return results
            .filter((r) => r.entry.type !== 'CODE_ENTITY')
            .map((r) => r.entry.id)
            .slice(0, 3);
    }
}
exports.MemSyncCode = MemSyncCode;
//# sourceMappingURL=sync-code.js.map