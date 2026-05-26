/** Data models for similarity analysis — duplicates, dead code, clusters. */
package com.codeintel.analyzers.similarity.models

/** A pair of similar functions with their cosine similarity score. */
data class SimilarityPair(
    val a: String,
    val b: String,
    val similarity: Double
)

/** A cluster of near-duplicate functions. */
data class Cluster(
    val representative: String,
    val members: List<String>
)

/** Report of detected duplicates. */
data class DuplicateReport(
    val totalFunctionsScanned: Int,
    val pairs: List<SimilarityPair>,
    val clusters: List<Cluster>,
    val suggestions: List<RefactoringSuggestion>
)

/** A refactoring suggestion for a duplicate cluster. */
data class RefactoringSuggestion(
    val clusterId: String,
    val suggestionType: String,
    val description: String,
    val members: List<String>,
    val estimatedLinesSaved: Int
)

/** A dead code candidate with confidence score. */
data class ScoredCandidate(
    val functionId: String,
    val name: String,
    val filePath: String,
    val startLine: Int,
    val endLine: Int,
    val confidence: Int,
    val reasons: List<String>
)

/** Report of detected dead code. */
data class DeadCodeReport(
    val totalFunctionsScanned: Int,
    val totalReachable: Int,
    val candidates: List<ScoredCandidate>,
    val summary: String
)

/** Symbol metadata for suggestion generation. */
data class SymbolInfo(
    val file: String,
    val name: String,
    val kind: String,
    val startLine: Int,
    val endLine: Int,
    val visibility: String?
)
