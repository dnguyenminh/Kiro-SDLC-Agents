/** Parser data provider interface — adapter for KSA-172. KSA-173. */
package com.codeintel.graph.engine.builder

import com.codeintel.graph.engine.model.GraphNode
import com.codeintel.graph.engine.model.GraphEdge

/**
 * Abstraction over the data source for graph construction.
 * Implementations can pull from DB (existing SQLite index) or from AST (KSA-172).
 */
interface ParserDataProvider {
    /** Get all indexed file paths. */
    fun getAllFiles(): List<String>

    /** Get all symbol nodes for a file. */
    fun getSymbolNodes(filePath: String): List<GraphNode>

    /** Get all call edges originating from a file. */
    fun getCallEdges(filePath: String): List<GraphEdge>

    /** Get all import edges for a file. */
    fun getImportEdges(filePath: String): List<GraphEdge>

    /** Register callback for file change events. */
    fun onFileChanged(callback: (String) -> Unit) {}
}
