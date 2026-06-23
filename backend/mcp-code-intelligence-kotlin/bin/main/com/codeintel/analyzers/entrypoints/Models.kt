/**
 * KSA-162: Entry Point Detection — Data models.
 */
package com.codeintel.analyzers.entrypoints

import kotlinx.serialization.Serializable

enum class EntryType { HTTP_HANDLER, MAIN, CLI_COMMAND, EVENT_HANDLER, SCHEDULED }

@Serializable
data class EntryPoint(
    val symbolId: Int,
    val symbolName: String,
    val filePath: String,
    val startLine: Int,
    val entryType: EntryType,
    val framework: String? = null,
    val httpMethod: String? = null,
    val routePath: String? = null,
    val fullRoute: String? = null,
    val middleware: List<String> = emptyList(),
    val hasAuth: Boolean = false,
    val controller: String? = null,
    val eventName: String? = null,
    val confidence: Confidence = Confidence.Medium,
)

enum class Confidence { High, Medium, Low }

@Serializable
data class FrameworkInfo(
    val name: String,
    val language: String,
    val confidence: Confidence,
)

@Serializable
data class EntryPointFilters(
    val entryType: EntryType? = null,
    val framework: String? = null,
    val httpMethod: String? = null,
    val routePattern: String? = null,
    val hasAuth: Boolean? = null,
    val filePath: String? = null,
    val limit: Int = 30,
)

@Serializable
data class EntryPointQueryResult(
    val results: List<EntryPoint>,
    val total: Int,
    val summary: EntryPointSummary,
)

@Serializable
data class EntryPointSummary(
    val byType: Map<String, Int>,
    val byFramework: Map<String, Int>,
    val authCoverage: AuthCoverage,
)

@Serializable
data class AuthCoverage(val withAuth: Int, val withoutAuth: Int)

data class FrameworkPatterns(
    val language: String,
    val imports: List<String>,
    val decorators: DecoratorPatterns? = null,
    val callPatterns: CallPatterns? = null,
    val authIndicators: List<String>,
)

data class DecoratorPatterns(
    val handler: List<String>,
    val prefix: List<String>? = null,
)

data class CallPatterns(
    val handler: List<String>,
    val mount: List<String>? = null,
)

data class SymbolInput(
    val id: Int,
    val name: String,
    val decorators: List<String>? = null,
    val parentName: String? = null,
    val filePath: String,
    val startLine: Int,
)
