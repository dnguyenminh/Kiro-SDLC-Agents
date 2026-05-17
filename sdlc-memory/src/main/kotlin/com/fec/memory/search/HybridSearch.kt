package com.fec.memory.search

import com.fec.memory.embedding.EmbeddingEngine
import com.fec.memory.graph.KnowledgeGraph
import com.fec.memory.storage.MemoryEntry
import com.fec.memory.storage.MemoryRepository
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

/**
 * Hybrid search using Reciprocal Rank Fusion (RRF).
 * Combines BM25 (FTS5) + Vector (cosine) + Graph (neighbors).
 */
class HybridSearch(
    private val repository: MemoryRepository,
    private val embeddings: EmbeddingEngine,
    private val graph: KnowledgeGraph,
) {
    fun search(
        query: String,
        ticketKey: String? = null,
        agent: String? = null,
        limit: Int = 10,
    ): List<SearchResult> {
        val bm25Results = searchBm25(query, limit * 3)
        val vectorResults = searchVector(query, limit * 3)
        val graphResults = searchGraph(bm25Results, limit)
        return fuseRrf(bm25Results, vectorResults, graphResults, limit)
    }

    private fun searchBm25(query: String, limit: Int): List<ScoredEntry> {
        val entries = repository.searchFts(query, limit)
        return entries.mapIndexed { i, e -> ScoredEntry(e, 1.0 / (i + 60.0)) }
    }

    private fun searchVector(query: String, limit: Int): List<ScoredEntry> {
        // Vector search requires embedding engine
        if (!embeddings.isAvailable()) return emptyList()
        // Placeholder: will use sqlite-vec for ANN search
        return emptyList()
    }

    private fun searchGraph(seeds: List<ScoredEntry>, limit: Int): List<ScoredEntry> {
        val neighborIds = seeds.take(5).flatMap { scored ->
            graph.getNeighbors(scored.entry.id, maxDepth = 1)
        }.distinct()
        // Graph boost: entries connected to top BM25 results
        return neighborIds.take(limit).mapIndexed { i, id ->
            ScoredEntry(
                entry = MemoryEntry(id = id, tier = "", category = "", title = "", content = ""),
                score = 1.0 / (i + 60.0)
            )
        }
    }

    private fun fuseRrf(
        bm25: List<ScoredEntry>,
        vector: List<ScoredEntry>,
        graphBoost: List<ScoredEntry>,
        limit: Int,
    ): List<SearchResult> {
        val scores = mutableMapOf<Long, Double>()
        bm25.forEach { scores[it.entry.id] = (scores[it.entry.id] ?: 0.0) + it.score }
        vector.forEach { scores[it.entry.id] = (scores[it.entry.id] ?: 0.0) + it.score }
        graphBoost.forEach { scores[it.entry.id] = (scores[it.entry.id] ?: 0.0) + it.score * 0.5 }

        val entryMap = (bm25 + vector).associate { it.entry.id to it.entry }
        return scores.entries
            .sortedByDescending { it.value }
            .take(limit)
            .mapNotNull { (id, score) ->
                entryMap[id]?.let { SearchResult(it, score) }
            }
    }
}

data class ScoredEntry(val entry: MemoryEntry, val score: Double)
data class SearchResult(val entry: MemoryEntry, val score: Double)
