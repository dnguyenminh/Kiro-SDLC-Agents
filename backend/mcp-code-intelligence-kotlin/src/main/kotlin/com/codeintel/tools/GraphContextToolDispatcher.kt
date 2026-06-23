/** Dispatcher for graph + context tools (8 tools). KSA-171. */
package com.codeintel.tools

import com.codeintel.context.AIContextService
import com.codeintel.context.CuratedContextService
import com.codeintel.context.EditContextService
import com.codeintel.graph.*
import com.codeintel.query.QueryLayer
import kotlinx.serialization.json.JsonObject
import java.sql.Connection

class GraphContextToolDispatcher(
    private val conn: Connection,
    private val workspace: String,
    private val queryLayer: QueryLayer,
) {
    private val resolver by lazy { SymbolResolver(conn) }
    private val callGraph by lazy { CallGraphService(conn, resolver) }
    private val fileResolver by lazy { FileResolver(conn, workspace) }
    private val depGraph by lazy { DependencyGraphService(conn, fileResolver) }
    private val testDetector by lazy { TestDetector(conn) }
    private val traverser by lazy { GraphTraverser(conn, resolver, workspace) }
    private val impactService by lazy { ImpactAnalysisService(conn, callGraph, depGraph, resolver, testDetector) }
    private val aiContext by lazy { AIContextService(conn, resolver, callGraph, workspace) }
    private val editContext by lazy { EditContextService(conn, resolver, callGraph, testDetector, workspace) }
    private val curatedContext by lazy { CuratedContextService(conn, queryLayer, traverser, resolver) }

    /** Dispatch graph/context tool call. Returns null if tool name not recognized. */
    fun dispatch(name: String, args: JsonObject): String? {
        return when (name) {
            "code_callers" -> CodeCallersTool(callGraph).execute(args)
            "code_callees" -> CodeCalleesTool(callGraph).execute(args)
            "code_traverse" -> CodeTraverseTool(traverser).execute(args)
            "code_impact" -> CodeImpactTool(impactService).execute(args)
            "code_dependencies" -> CodeDependenciesTool(depGraph).execute(args)
            "get_ai_context" -> AIContextTool(aiContext).execute(args)
            "get_edit_context" -> EditContextTool(editContext).execute(args)
            "get_curated_context" -> CuratedContextTool(curatedContext).execute(args)
            else -> null
        }
    }
}
