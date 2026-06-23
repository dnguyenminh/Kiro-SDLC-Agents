/** Context module data models — KSA-171. */
package com.codeintel.context.models

import kotlinx.serialization.Serializable

@Serializable
data class AIContextParams(
    val symbol: String,
    val intent: String = "explain",
    val tokenBudget: Int = 4000,
    val callerDepth: Int = 1,
)

@Serializable
data class AIContextResponse(
    val symbol: String,
    val filePath: String,
    val kind: String,
    val intent: String,
    val context: Map<String, String> = emptyMap(),
    val metadata: ContextMetadata,
)

@Serializable
data class ContextMetadata(
    val budgetUsed: Int = 0,
    val budgetTotal: Int = 0,
    val sectionsIncluded: List<String> = emptyList(),
    val sectionsOmitted: List<String> = emptyList(),
    val queryTimeMs: Long = 0,
)

@Serializable
data class EditContextParams(
    val symbol: String,
    val includeCallers: Boolean = true,
    val includeTests: Boolean = true,
    val includeMemories: Boolean = false,
    val includeGit: Boolean = true,
    val tokenBudget: Int = 4000,
    val callerDepth: Int = 1,
)

@Serializable
data class EditContextResult(
    val symbol: String,
    val file: String,
    val line: Int,
    val kind: String,
    val source: String,
    val signature: String? = null,
    val callers: List<CallerContext>? = null,
    val tests: List<TestContext>? = null,
    val gitHistory: List<GitCommit>? = null,
    val siblings: List<SiblingContext>? = null,
    val metadata: EditMetadata = EditMetadata(),
)

@Serializable
data class EditMetadata(
    val tokenCount: Int = 0,
    val tokenBudget: Int = 0,
    val sectionsIncluded: List<String> = emptyList(),
    val sectionsExcluded: List<String> = emptyList(),
    val queryTimeMs: Long = 0,
)

@Serializable
data class CallerContext(
    val symbol: String,
    val file: String,
    val line: Int,
    val context: String,
)

@Serializable
data class TestContext(
    val file: String,
    val testName: String,
    val source: String,
)

@Serializable
data class GitCommit(
    val hash: String,
    val message: String,
)

@Serializable
data class SiblingContext(
    val name: String,
    val kind: String,
    val signature: String? = null,
    val line: Int,
)

@Serializable
data class CuratedContextParams(
    val query: String,
    val maxTokens: Int = 4000,
    val scope: String? = null,
    val modules: List<String>? = null,
    val includeSource: Boolean = true,
    val includeMemory: Boolean = true,
    val includeGraph: Boolean = true,
    val sourceWeights: SourceWeights? = null,
)

@Serializable
data class SourceWeights(
    val code: Double = 0.5,
    val memory: Double = 0.3,
    val graph: Double = 0.2,
)

@Serializable
data class CuratedContextResponse(
    val query: String,
    val sections: List<ContextSection> = emptyList(),
    val metadata: CuratedMetadata = CuratedMetadata(),
)

@Serializable
data class CuratedMetadata(
    val tokensUsed: Int = 0,
    val tokensBudget: Int = 0,
    val sourcesQueried: List<String> = emptyList(),
    val totalCandidates: Int = 0,
    val resultsReturned: Int = 0,
    val executionTimeMs: Long = 0,
)

@Serializable
data class ContextSection(
    val title: String,
    val source: String,
    val items: List<ContextItem> = emptyList(),
)

@Serializable
data class ContextItem(
    val name: String,
    val kind: String? = null,
    val file: String? = null,
    val line: Int? = null,
    val relevance: Double = 0.0,
    val detail: String = "reference",
    val content: String = "",
    val relationship: String? = null,
)

@Serializable
data class QueryAnalysis(
    val originalQuery: String,
    val keywords: List<String>,
    val symbolCandidates: List<String>,
    val phrases: List<String>,
    val ftsQuery: String,
)

@Serializable
data class MergedResult(
    val name: String,
    val id: Int? = null,
    val kind: String? = null,
    val file: String? = null,
    val line: Int? = null,
    val signature: String? = null,
    val sourceCode: String? = null,
    val content: String? = null,
    val relevanceScore: Double = 0.0,
    val sources: List<String> = emptyList(),
    val relationship: String? = null,
)

@Serializable
data class AllocatedResult(
    val name: String,
    val id: Int? = null,
    val kind: String? = null,
    val file: String? = null,
    val line: Int? = null,
    val signature: String? = null,
    val content: String = "",
    val relevanceScore: Double = 0.0,
    val sources: List<String> = emptyList(),
    val relationship: String? = null,
    val detail: String = "reference",
    val tokens: Int = 0,
)
