/**
 * Creates graph edges between ingested chunks from the same document.
 */

import { KnowledgeGraph } from './knowledge-graph.js';

/** Relation types for ingest-created edges. */
export const RELATION_SIBLING = 'SIBLING';
export const RELATION_DERIVED_FROM = 'DERIVED_FROM';

/** Links ingested entries with graph edges (sibling + source relationships). */
export class IngestGraphLinker {
  private readonly graph: KnowledgeGraph;

  constructor(graph: KnowledgeGraph) {
    this.graph = graph;
  }

  /** Create sibling edges for a batch of chunk IDs from the same document. */
  linkChunks(chunkIds: number[], source: string): void {
    if (chunkIds.length < 2) return;
    this.createSiblingEdges(chunkIds);
    console.error(`[ingest-linker] created ${chunkIds.length - 1} edges for ${chunkIds.length} chunks from ${source}`);
  }

  /** Create DERIVED_FROM edge between entry and its source. */
  linkToSource(entryId: number, sourceEntryId: number): void {
    this.graph.addEdge({
      source_id: entryId,
      target_id: sourceEntryId,
      relation: RELATION_DERIVED_FROM,
      weight: 0.8,
      metadata: '{"auto":"ingest"}',
    });
  }

  /** Calculate how many edges would be created for a chunk list. */
  edgeCount(chunkIds: number[]): number {
    return chunkIds.length < 2 ? 0 : chunkIds.length - 1;
  }

  private createSiblingEdges(chunkIds: number[]): void {
    for (let i = 0; i < chunkIds.length - 1; i++) {
      this.graph.addEdge({
        source_id: chunkIds[i],
        target_id: chunkIds[i + 1],
        relation: RELATION_SIBLING,
        weight: 1.0,
        metadata: `{"auto":"ingest","order":${i}}`,
      });
    }
  }
}
