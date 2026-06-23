/**
 * KSA-164: Taint Analyzer — Main taint analysis engine.
 */
package com.codeintel.analyzers.security.taint

import com.codeintel.analyzers.security.*
import com.codeintel.analyzers.security.cfg.CFGBuilder
import com.codeintel.analyzers.security.dataflow.DataFlowAnalyzer
import com.codeintel.parsers.SyntaxNode

class TaintAnalyzer(registry: TaintRegistry? = null) {
    private val cfgBuilder = CFGBuilder()
    private val dataFlowAnalyzer = DataFlowAnalyzer()
    private val _registry = registry ?: TaintRegistry()
    private val propagator = TaintPropagator(_registry)

    val registry: TaintRegistry get() = _registry

    fun analyze(functionNode: SyntaxNode, language: String, options: TaintOptions = TaintOptions()): TaintResult {
        val maxPathLength = options.maxPathLength

        val cfg = cfgBuilder.build(functionNode, language)

        val blockStates = mutableMapOf<Int, MutableMap<String, TaintState>>()
        val initialState = mutableMapOf<String, TaintState>()
        blockStates[cfg.entry.id] = initialState

        identifyParamSources(functionNode, language, initialState)

        for (block in cfg.reversePostOrder()) {
            val predecessors = cfg.getPredecessors(block)
            val mergedState: MutableMap<String, TaintState> = if (predecessors.isEmpty()) {
                (blockStates[block.id] ?: initialState).toMutableMap()
            } else {
                val merged = mutableMapOf<String, TaintState>()
                for (pred in predecessors) {
                    blockStates[pred.id]?.forEach { (key, value) ->
                        if (key !in merged) merged[key] = value
                    }
                }
                merged
            }

            val outState = propagator.propagateBlock(block, mergedState)
            blockStates[block.id] = outState
        }

        val paths = mutableListOf<TaintPath>()
        val sources = mutableListOf<TaintSource>()
        val sinks = mutableListOf<TaintSink>()

        for (block in cfg.blocks) {
            val state = blockStates[block.id] ?: continue
            for (stmt in block.statements) {
                val sinkInfo = findSink(stmt.node, state, language)
                if (sinkInfo != null) {
                    sinks.add(sinkInfo.sink)
                    val ts = sinkInfo.taintState
                    if (ts != null) {
                        val sourceType = try { TaintSourceType.valueOf(ts.sourceType.uppercase()) } catch (_: Exception) { TaintSourceType.HTTP_PARAM }
                        val path = TaintPath(
                            source = TaintSource(ts.variable, sourceType, ts.sourceLine, ts.variable),
                            sink = sinkInfo.sink,
                            chain = ts.steps.take(maxPathLength),
                            sanitized = false,
                            length = ts.steps.size
                        )
                        paths.add(path)
                        if (sources.none { it.variable == path.source.variable && it.line == path.source.line }) {
                            sources.add(path.source)
                        }
                    }
                }
            }
        }

        var filteredPaths = paths.toList()
        options.sinkTypes?.let { types -> filteredPaths = filteredPaths.filter { it.sink.type in types } }
        options.sourceTypes?.let { types -> filteredPaths = filteredPaths.filter { it.source.type in types } }
        if (!options.includeSanitized) filteredPaths = filteredPaths.filter { !it.sanitized }

        return TaintResult(paths = filteredPaths, sources = sources, sinks = sinks, sanitizers = emptyList())
    }

    private fun identifyParamSources(functionNode: SyntaxNode, language: String, state: MutableMap<String, TaintState>) {
        val params = functionNode.childByFieldName("parameters") ?: return
        val httpParams = setOf("req", "request", "ctx", "context")

        for (param in params.namedChildren) {
            val paramName: String? = when (param.type) {
                "identifier" -> param.text
                "required_parameter", "optional_parameter" -> {
                    (param.childByFieldName("pattern") ?: param.childByFieldName("name"))?.text
                }
                else -> null
            }
            if (paramName != null && paramName in httpParams) {
                state[paramName] = TaintState(paramName, true, "http_param", param.startPoint.row + 1)
            }
        }
    }

    private data class SinkInfo(val sink: TaintSink, val taintState: TaintState?)

    private fun findSink(node: SyntaxNode, state: Map<String, TaintState>, language: String): SinkInfo? {
        if (node.type in listOf("call_expression", "expression_statement")) {
            val callNode = if (node.type == "expression_statement" && node.namedChildCount > 0)
                node.namedChildren.first() else node
            if (callNode.type != "call_expression") return null

            val fn = callNode.childByFieldName("function") ?: return null
            val sinkMatch = _registry.matchSink(fn.text, language) ?: return null

            val sink = TaintSink(fn.text, sinkMatch.type, callNode.startPoint.row + 1, callNode.text.take(100), sinkMatch.paramIndex)

            val args = callNode.childByFieldName("arguments")
            if (args != null && args.namedChildren.size > sinkMatch.paramIndex) {
                val targetArg = args.namedChildren[sinkMatch.paramIndex]
                val taintInfo = propagator.evaluateExpression(targetArg, state)
                if (taintInfo.tainted) {
                    return SinkInfo(sink, TaintState(targetArg.text.take(50), true, taintInfo.sourceType, taintInfo.sourceLine, taintInfo.steps))
                }
            }
            return SinkInfo(sink, null)
        }

        for (child in node.namedChildren) {
            val result = findSink(child, state, language)
            if (result?.taintState != null) return result
        }
        return null
    }
}
