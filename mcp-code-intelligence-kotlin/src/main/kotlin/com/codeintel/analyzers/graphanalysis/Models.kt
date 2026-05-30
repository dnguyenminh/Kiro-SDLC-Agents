/**
 * KSA-163: Graph Analysis — Data models.
 */
package com.codeintel.analyzers.graphanalysis

import kotlinx.serialization.Serializable

@Serializable
data class CircularDep(
    val cycle: CycleChain,
    val length: Int,
    val severity: String, // high, medium, low
    val module: String? = null,
)

@Serializable
data class CycleChain(
    val nodes: List<CycleNode>,
    val edges: List<String>,
)

@Serializable
data class CycleNode(
    val symbolId: Int,
    val name: String,
    val filePath: String,
    val kind: String,
)

@Serializable
data class RelatedTestResult(
    val symbol: SymbolRef,
    val directTests: List<TestReference>,
    val indirectTests: List<TestReference>,
    val totalTests: Int,
)

@Serializable
data class SymbolRef(val id: Int, val name: String, val filePath: String)

@Serializable
data class TestReference(
    val symbolId: Int,
    val testName: String,
    val filePath: String,
    val depth: Int,
    val path: List<String>,
)

@Serializable
data class HotPath(
    val symbolId: Int,
    val symbolName: String,
    val filePath: String,
    val directCallers: Int,
    val transitiveCallers: Int,
    val kind: String,
)

@Serializable
data class DeadImport(
    val filePath: String,
    val line: Int,
    val importedSymbol: String,
    val fromModule: String,
)

@Serializable
data class ModuleSummary(
    val module: String,
    val fileCount: Int,
    val symbolCount: Int,
    val circularDeps: Int,
    val hotPaths: List<HotPath>,
    val deadImports: Int,
    val avgComplexity: Double?,
)

data class SymbolInfo(
    val id: Int,
    val name: String,
    val kind: String,
    val filePath: String,
)

typealias AdjacencyList = MutableMap<Int, MutableList<Int>>
