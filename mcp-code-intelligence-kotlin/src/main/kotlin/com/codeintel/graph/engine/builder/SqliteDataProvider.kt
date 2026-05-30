/** SQLite-backed parser data provider — adapts existing DB index. KSA-173. */
package com.codeintel.graph.engine.builder

import com.codeintel.graph.engine.model.*
import java.sql.Connection

/**
 * Reads symbol and relationship data from the existing SQLite index
 * (populated by IndexingEngine) to construct in-memory graphs.
 */
class SqliteDataProvider(private val conn: Connection) : ParserDataProvider {

    override fun getAllFiles(): List<String> {
        val stmt = conn.prepareStatement("SELECT relative_path FROM files WHERE relative_path IS NOT NULL")
        val rs = stmt.executeQuery()
        val files = mutableListOf<String>()
        while (rs.next()) files.add(rs.getString(1))
        return files
    }

    override fun getSymbolNodes(filePath: String): List<GraphNode> {
        val stmt = conn.prepareStatement("""
            SELECT s.name, s.kind, s.start_line, s.visibility, f.relative_path
            FROM symbols s JOIN files f ON s.file_id = f.id
            WHERE f.relative_path = ?
        """.trimIndent())
        stmt.setString(1, filePath)
        val rs = stmt.executeQuery()
        val nodes = mutableListOf<GraphNode>()
        while (rs.next()) {
            nodes.add(GraphNode(
                id = "${filePath}::${rs.getString("name")}",
                type = mapKind(rs.getString("kind")),
                name = rs.getString("name"),
                filePath = filePath,
                position = Position(rs.getInt("start_line"), 0),
                visibility = mapVisibility(rs.getString("visibility"))
            ))
        }
        return nodes
    }

    override fun getCallEdges(filePath: String): List<GraphEdge> {
        val stmt = conn.prepareStatement("""
            SELECT s.name AS caller, r.target_symbol AS callee, r.line, r.kind
            FROM relationships r
            JOIN symbols s ON s.id = r.source_symbol_id
            JOIN files f ON s.file_id = f.id
            WHERE f.relative_path = ? AND r.kind = 'calls'
        """.trimIndent())
        stmt.setString(1, filePath)
        val rs = stmt.executeQuery()
        val edges = mutableListOf<GraphEdge>()
        while (rs.next()) {
            edges.add(GraphEdge(
                source = "${filePath}::${rs.getString("caller")}",
                target = rs.getString("callee"),
                type = EdgeType.CALL,
                metadata = EdgeMetadata(
                    callType = CallType.DIRECT,
                    confidence = 1.0f,
                    sourcePosition = Position(rs.getInt("line"), 0)
                )
            ))
        }
        return edges
    }

    override fun getImportEdges(filePath: String): List<GraphEdge> {
        val stmt = conn.prepareStatement("""
            SELECT r.target_symbol, r.line
            FROM relationships r
            JOIN files f ON r.file_path = f.relative_path
            WHERE f.relative_path = ? AND r.kind = 'imports'
        """.trimIndent())
        stmt.setString(1, filePath)
        val rs = stmt.executeQuery()
        val edges = mutableListOf<GraphEdge>()
        while (rs.next()) {
            edges.add(GraphEdge(
                source = filePath,
                target = rs.getString("target_symbol"),
                type = EdgeType.STATIC_IMPORT,
                metadata = EdgeMetadata(sourcePosition = Position(rs.getInt("line"), 0))
            ))
        }
        return edges
    }

    private fun mapKind(kind: String?): NodeType = when (kind) {
        "function" -> NodeType.FUNCTION
        "method" -> NodeType.METHOD
        "class" -> NodeType.CLASS
        "constructor" -> NodeType.CONSTRUCTOR
        "property", "variable" -> NodeType.PROPERTY
        else -> NodeType.FUNCTION
    }

    private fun mapVisibility(vis: String?): Visibility? = when (vis) {
        "public" -> Visibility.PUBLIC
        "private" -> Visibility.PRIVATE
        "internal" -> Visibility.INTERNAL
        "protected" -> Visibility.PROTECTED
        else -> null
    }
}
