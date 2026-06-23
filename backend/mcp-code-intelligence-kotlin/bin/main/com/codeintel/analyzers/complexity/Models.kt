/**
 * KSA-161: Complexity Analyzer — Data models.
 */
package com.codeintel.analyzers.complexity

import kotlinx.serialization.Serializable

enum class Grade { A, B, C, D, F }

@Serializable
data class DecisionPointCounts(
    val branches: Int = 0,
    val loops: Int = 0,
    val logicalOps: Int = 0,
    val exceptionHandlers: Int = 0,
)

@Serializable
data class ComplexityBreakdown(
    val cyclomaticComplexity: Int,
    val branches: Int,
    val loops: Int,
    val logicalOps: Int,
    val exceptionHandlers: Int,
    val nestingDepth: Int,
    val earlyReturns: Int,
)

@Serializable
data class ComplexityResult(
    val symbolId: Int,
    val symbolName: String,
    val filePath: String,
    val startLine: Int,
    val endLine: Int,
    val grade: Grade,
    val cyclomaticComplexity: Int,
    val branches: Int,
    val loops: Int,
    val logicalOps: Int,
    val exceptionHandlers: Int,
    val nestingDepth: Int,
    val earlyReturns: Int,
)

@Serializable
data class FileComplexityResult(
    val filePath: String,
    val functions: List<ComplexityResult>,
    val averageComplexity: Double,
    val maxComplexity: Int,
    val totalFunctions: Int,
)

@Serializable
data class ComplexityFilters(
    val filePath: String? = null,
    val symbolName: String? = null,
    val minComplexity: Int? = null,
    val gradeFilter: List<Grade>? = null,
    val module: String? = null,
    val limit: Int = 20,
    val sortBy: SortBy = SortBy.COMPLEXITY,
)

enum class SortBy { COMPLEXITY, NAME, FILE }

@Serializable
data class ComplexityQueryResult(
    val results: List<ComplexityResult>,
    val total: Int,
    val summary: ComplexitySummary,
)

@Serializable
data class ComplexitySummary(
    val average: Double,
    val gradeDistribution: Map<Grade, Int>,
)

@Serializable
data class GradeThresholds(
    val a: Int = 5,
    val b: Int = 10,
    val c: Int = 20,
    val d: Int = 50,
)
