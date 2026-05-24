"use strict";
/**
 * Creates graph edges between ingested chunks from the same document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestGraphLinker = exports.RELATION_DERIVED_FROM = exports.RELATION_SIBLING = void 0;
/** Relation types for ingest-created edges. */
exports.RELATION_SIBLING = 'SIBLING';
exports.RELATION_DERIVED_FROM = 'DERIVED_FROM';
/** Links ingested entries with graph edges (sibling + source relationships). */
class IngestGraphLinker {
    graph;
    constructor(graph) {
        this.graph = graph;
    }
    /** Create sibling edges for a batch of chunk IDs from the same document. */
    linkChunks(chunkIds, source) {
        if (chunkIds.length < 2)
            return;
        this.createSiblingEdges(chunkIds);
        console.error(`[ingest-linker] created ${chunkIds.length - 1} edges for ${chunkIds.length} chunks from ${source}`);
    }
    /** Create DERIVED_FROM edge between entry and its source. */
    linkToSource(entryId, sourceEntryId) {
        this.graph.addEdge({
            source_id: entryId,
            target_id: sourceEntryId,
            relation: exports.RELATION_DERIVED_FROM,
            weight: 0.8,
            metadata: '{"auto":"ingest"}',
        });
    }
    /** Calculate how many edges would be created for a chunk list. */
    edgeCount(chunkIds) {
        return chunkIds.length < 2 ? 0 : chunkIds.length - 1;
    }
    createSiblingEdges(chunkIds) {
        for (let i = 0; i < chunkIds.length - 1; i++) {
            this.graph.addEdge({
                source_id: chunkIds[i],
                target_id: chunkIds[i + 1],
                relation: exports.RELATION_SIBLING,
                weight: 1.0,
                metadata: `{"auto":"ingest","order":${i}}`,
            });
        }
    }
}
exports.IngestGraphLinker = IngestGraphLinker;
//# sourceMappingURL=ingest-graph-linker.js.map