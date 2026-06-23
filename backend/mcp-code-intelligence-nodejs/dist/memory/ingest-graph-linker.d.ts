/**
 * Creates graph edges between ingested chunks from the same document.
 */
import { KnowledgeGraph } from './knowledge-graph.js';
/** Relation types for ingest-created edges. */
export declare const RELATION_SIBLING = "SIBLING";
export declare const RELATION_DERIVED_FROM = "DERIVED_FROM";
/** Links ingested entries with graph edges (sibling + source relationships). */
export declare class IngestGraphLinker {
    private readonly graph;
    constructor(graph: KnowledgeGraph);
    /** Create sibling edges for a batch of chunk IDs from the same document. */
    linkChunks(chunkIds: number[], source: string): void;
    /** Create DERIVED_FROM edge between entry and its source. */
    linkToSource(entryId: number, sourceEntryId: number): void;
    /** Calculate how many edges would be created for a chunk list. */
    edgeCount(chunkIds: number[]): number;
    private createSiblingEdges;
}
//# sourceMappingURL=ingest-graph-linker.d.ts.map