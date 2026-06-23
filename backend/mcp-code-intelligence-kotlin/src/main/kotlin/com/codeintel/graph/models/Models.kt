/** Graph engine data models — KSA-173. */
package com.codeintel.graph.models

enum class Severity(val value: String) {
    CRITICAL("critical"), HIGH("high"), MEDIUM("medium"), LOW("low");

    companion object {
        fun order(s: Severity): Int = when (s) {
            CRITICAL -> 0; HIGH -> 1; MEDIUM -> 2; LOW -> 3
        }
    }
}

enum class ImpactAction(val value: String) {
    MODIFY("modify"), DELETE("delete"), RENAME("rename")
}

data class ResolvedSymbol(
    val id: Int,
    val name: String,
    val kind: String,
    val filePath: String,
    val line: Int,
    val parentSymbolId: Int? = null,
)

data class DependencyNode(
    val file: String,
    val depth: Int,
    val importedSymbols: List<String> = emptyList(),
    val isExternal: Boolean = false,
)

data class DependencyMetadata(
    val totalNodes: Int = 0,
    val maxDepthReached: Int = 0,
    val truncated: Boolean = false,
    val queryTimeMs: Long = 0,
    val externalCount: Int = 0,
)

data class DependencyResult(
    val root: String,
    val direction: String,
    val results: List<DependencyNode> = emptyList(),
    val cycles: List<List<String>> = emptyList(),
    val metadata: DependencyMetadata = DependencyMetadata(),
)

data class CallGraphItem(
    val symbol: String,
    val qualifiedName: String,
    val kind: String,
    val filePath: String,
    val definitionLine: Int,
    val callSiteLine: Int,
    val depthLevel: Int,
    val parameters: String? = null,
    val isAsync: Boolean = false,
)

data class CallGraphMetadata(
    val totalCount: Int = 0,
    val depthSearched: Int = 0,
    val truncated: Boolean = false,
    val queryTimeMs: Long = 0,
)

data class ResolvedTo(val id: Int, val file: String, val line: Int, val kind: String)

data class CallGraphResponse(
    val symbol: String,
    val resolvedTo: List<ResolvedTo> = emptyList(),
    val results: List<CallGraphItem> = emptyList(),
    val metadata: CallGraphMetadata = CallGraphMetadata(),
)

data class GraphNode(
    val id: Int,
    val name: String,
    val kind: String,
    val filePath: String,
    val startLine: Int,
    val incomingEdgeType: String? = null,
)

data class TraverseConfig(
    val edgeTypes: List<String> = emptyList(),
    val nodeTypes: List<String> = emptyList(),
    val direction: String = "outgoing",
    val maxDepth: Int = 3,
    val maxResults: Int = 50,
)

data class TraverseResultItem(
    val node: GraphNode,
    val depth: Int,
    val path: List<String> = emptyList(),
    val edgeType: String = "unknown",
)

data class TraverseResponse(
    val start: Map<String, Any>,
    val results: List<Map<String, Any>>,
    val metadata: Map<String, Any>,
)

data class ImpactItem(
    val symbol: String,
    val file: String,
    val line: Int,
    val severity: Severity,
    val reason: String,
    val qualifiedName: String? = null,
    val chain: List<String>? = null,
)

data class BlastRadius(
    val summary: Map<String, Int> = mapOf("critical" to 0, "high" to 0, "medium" to 0, "low" to 0),
    val totalAffected: Int = 0,
    val affectedFiles: Int = 0,
    val affectedTests: Int = 0,
)

data class ImpactResult(
    val symbol: String,
    val action: ImpactAction,
    val blastRadius: BlastRadius = BlastRadius(),
    val impacts: List<ImpactItem> = emptyList(),
    val affectedTests: List<RelatedTest> = emptyList(),
    val recommendations: List<String> = emptyList(),
    val metadata: Map<String, Any> = emptyMap(),
)

data class RelatedTest(val file: String, val reason: String)
