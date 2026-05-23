/**
 * EntityRepository — CRUD for entity_index table.
 * Supports searching entries by entity name or type.
 * Port of Node.js entity-repo.ts (KSA-142 F3).
 */
package com.codeintel.memory.map

import java.sql.Connection

data class EntityRecord(
    val id: Int,
    val entryId: Int,
    val entityName: String,
    val entityType: String
)

class EntityRepository(private val db: Connection) {

    /** Index entities for an entry (replaces existing). */
    fun indexEntities(entryId: Int, entities: List<String>, entityType: String = "auto") {
        db.prepareStatement("DELETE FROM entity_index WHERE entry_id = ?")
            .use { it.setInt(1, entryId); it.executeUpdate() }
        val ps = db.prepareStatement(
            "INSERT INTO entity_index (entry_id, entity_name, entity_type) VALUES (?, ?, ?)"
        )
        for (name in entities) {
            ps.setInt(1, entryId)
            ps.setString(2, name)
            ps.setString(3, entityType)
            ps.addBatch()
        }
        ps.executeBatch()
        ps.close()
    }

    /** Find entry IDs that mention a specific entity. */
    fun findByEntity(entityName: String, limit: Int = 20): List<Int> {
        val ps = db.prepareStatement(
            "SELECT DISTINCT entry_id FROM entity_index WHERE entity_name LIKE ? LIMIT ?"
        )
        ps.setString(1, "%$entityName%"); ps.setInt(2, limit)
        val rs = ps.executeQuery()
        val results = mutableListOf<Int>()
        while (rs.next()) results.add(rs.getInt(1))
        rs.close(); ps.close()
        return results
    }

    /** Find entry IDs by entity type. */
    fun findByType(entityType: String, limit: Int = 20): List<Int> {
        val ps = db.prepareStatement(
            "SELECT DISTINCT entry_id FROM entity_index WHERE entity_type = ? LIMIT ?"
        )
        ps.setString(1, entityType); ps.setInt(2, limit)
        val rs = ps.executeQuery()
        val results = mutableListOf<Int>()
        while (rs.next()) results.add(rs.getInt(1))
        rs.close(); ps.close()
        return results
    }

    /** Get all entities for an entry. */
    fun getEntities(entryId: Int): List<EntityRecord> {
        val ps = db.prepareStatement(
            "SELECT id, entry_id, entity_name, entity_type FROM entity_index WHERE entry_id = ?"
        )
        ps.setInt(1, entryId)
        val rs = ps.executeQuery()
        val results = mutableListOf<EntityRecord>()
        while (rs.next()) {
            results.add(EntityRecord(
                id = rs.getInt("id"),
                entryId = rs.getInt("entry_id"),
                entityName = rs.getString("entity_name"),
                entityType = rs.getString("entity_type")
            ))
        }
        rs.close(); ps.close()
        return results
    }

    /** Search entities by name pattern. */
    fun searchEntities(pattern: String, limit: Int = 20): List<EntityRecord> {
        val ps = db.prepareStatement(
            "SELECT id, entry_id, entity_name, entity_type FROM entity_index WHERE entity_name LIKE ? LIMIT ?"
        )
        ps.setString(1, "%$pattern%"); ps.setInt(2, limit)
        val rs = ps.executeQuery()
        val results = mutableListOf<EntityRecord>()
        while (rs.next()) {
            results.add(EntityRecord(
                id = rs.getInt("id"),
                entryId = rs.getInt("entry_id"),
                entityName = rs.getString("entity_name"),
                entityType = rs.getString("entity_type")
            ))
        }
        rs.close(); ps.close()
        return results
    }
}
