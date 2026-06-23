/** CRUD operations for knowledge graph edges. */
package com.codeintel.memory.repository

import com.codeintel.memory.db.MemoryDatabaseManager
import com.codeintel.memory.models.GraphEdge
import java.sql.ResultSet

class GraphRepository(private val db: MemoryDatabaseManager) {

    /** Add an edge between two knowledge entries. */
    fun addEdge(edge: GraphEdge): Long {
        val sql = """
            INSERT INTO knowledge_graph_edges
            (source_id, target_id, relation, weight, metadata)
            VALUES (?, ?, ?, ?, ?)
        """.trimIndent()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, edge.sourceId)
            stmt.setLong(2, edge.targetId)
            stmt.setString(3, edge.relation)
            stmt.setDouble(4, edge.weight)
            stmt.setString(5, edge.metadata)
            stmt.executeUpdate()
        }
        return lastInsertId()
    }

    /** Get all edges from a source node. */
    fun getOutgoing(sourceId: Long): List<GraphEdge> {
        val sql = "SELECT * FROM knowledge_graph_edges WHERE source_id = ?"
        return queryEdges(sql) { it.setLong(1, sourceId) }
    }

    /** Get all edges pointing to a target node. */
    fun getIncoming(targetId: Long): List<GraphEdge> {
        val sql = "SELECT * FROM knowledge_graph_edges WHERE target_id = ?"
        return queryEdges(sql) { it.setLong(1, targetId) }
    }

    /** Get all edges for a node (both directions). */
    fun getConnected(entryId: Long): List<GraphEdge> {
        val sql = "SELECT * FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?"
        return queryEdges(sql) { stmt ->
            stmt.setLong(1, entryId)
            stmt.setLong(2, entryId)
        }
    }

    /** Find edges by relation type. */
    fun findByRelation(relation: String, limit: Int = 50): List<GraphEdge> {
        val sql = "SELECT * FROM knowledge_graph_edges WHERE relation = ? LIMIT ?"
        return queryEdges(sql) { stmt ->
            stmt.setString(1, relation)
            stmt.setInt(2, limit)
        }
    }

    /** Remove an edge by ID. */
    fun removeEdge(id: Long) {
        db.conn.prepareStatement("DELETE FROM knowledge_graph_edges WHERE id = ?").use { stmt ->
            stmt.setLong(1, id)
            stmt.executeUpdate()
        }
    }

    /** Remove all edges for an entry. */
    fun removeAllEdges(entryId: Long) {
        val sql = "DELETE FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?"
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, entryId)
            stmt.setLong(2, entryId)
            stmt.executeUpdate()
        }
    }

    /** Count total edges in graph. */
    fun countEdges(): Int {
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT COUNT(*) FROM knowledge_graph_edges")
            rs.next()
            return rs.getInt(1)
        }
    }

    /** Get all edges (for loading graph into memory). */
    fun findAll(limit: Int = 10000): List<GraphEdge> {
        val sql = "SELECT * FROM knowledge_graph_edges LIMIT ?"
        return queryEdges(sql) { it.setInt(1, limit) }
    }

    private fun lastInsertId(): Long {
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT last_insert_rowid()")
            rs.next()
            return rs.getLong(1)
        }
    }

    private fun queryEdges(
        sql: String,
        bind: (java.sql.PreparedStatement) -> Unit
    ): List<GraphEdge> {
        val results = mutableListOf<GraphEdge>()
        db.conn.prepareStatement(sql).use { stmt ->
            bind(stmt)
            val rs = stmt.executeQuery()
            while (rs.next()) results.add(mapEdge(rs))
        }
        return results
    }

    private fun mapEdge(rs: ResultSet) = GraphEdge(
        id = rs.getLong("id"),
        sourceId = rs.getLong("source_id"),
        targetId = rs.getLong("target_id"),
        relation = rs.getString("relation"),
        weight = rs.getDouble("weight"),
        metadata = rs.getString("metadata"),
        createdAt = rs.getString("created_at")
    )
}
