/** Creates graph edges between ingested chunks from the same document. */
package com.codeintel.memory.ingest

import com.codeintel.log
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.models.GraphEdge

/** Relation types for ingest-created edges. */
object IngestRelations {
    const val SIBLING = "SIBLING"
    const val DERIVED_FROM = "DERIVED_FROM"
}

/** Links ingested entries with graph edges (sibling + source relationships). */
class IngestGraphLinker(private val graph: KnowledgeGraph) {

    /** Create edges for a batch of chunk IDs from the same document. */
    fun linkChunks(chunkIds: List<Long>, source: String) {
        if (chunkIds.size < 2) return
        createSiblingEdges(chunkIds)
        log("IngestGraphLinker: created ${chunkIds.size - 1} edges for ${chunkIds.size} chunks from $source")
    }

    /** Create edges between a single entry and an existing source entry. */
    fun linkToSource(entryId: Long, sourceEntryId: Long) {
        val edge = GraphEdge(
            sourceId = entryId,
            targetId = sourceEntryId,
            relation = IngestRelations.DERIVED_FROM,
            weight = 0.8,
            metadata = """{"auto":"ingest"}"""
        )
        graph.addEdge(edge)
    }

    /** Calculate how many edges would be created for a chunk list. */
    fun edgeCount(chunkIds: List<Long>): Int {
        return if (chunkIds.size < 2) 0 else chunkIds.size - 1
    }

    private fun createSiblingEdges(chunkIds: List<Long>) {
        for (i in 0 until chunkIds.size - 1) {
            val edge = GraphEdge(
                sourceId = chunkIds[i],
                targetId = chunkIds[i + 1],
                relation = IngestRelations.SIBLING,
                weight = 1.0,
                metadata = """{"auto":"ingest","order":$i}"""
            )
            graph.addEdge(edge)
        }
    }
}
