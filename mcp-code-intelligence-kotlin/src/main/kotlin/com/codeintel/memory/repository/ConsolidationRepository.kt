/** CRUD operations for consolidation log (tier transitions). */
package com.codeintel.memory.repository

import com.codeintel.memory.db.MemoryDatabaseManager
import com.codeintel.memory.models.ConsolidationRecord
import com.codeintel.memory.models.TierStats
import java.sql.ResultSet

class ConsolidationRepository(private val db: MemoryDatabaseManager) {

    /** Log a tier transition. */
    fun logTransition(entryId: Long, fromTier: String, toTier: String, reason: String): Long {
        val sql = """
            INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason)
            VALUES (?, ?, ?, ?)
        """.trimIndent()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, entryId)
            stmt.setString(2, fromTier)
            stmt.setString(3, toTier)
            stmt.setString(4, reason)
            stmt.executeUpdate()
        }
        return lastInsertId()
    }

    /** Get consolidation history for an entry. */
    fun getHistory(entryId: Long): List<ConsolidationRecord> {
        val sql = "SELECT * FROM consolidation_log WHERE entry_id = ? ORDER BY consolidated_at DESC"
        val results = mutableListOf<ConsolidationRecord>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, entryId)
            val rs = stmt.executeQuery()
            while (rs.next()) results.add(mapRow(rs))
        }
        return results
    }

    /** Get tier statistics. */
    fun getTierStats(): List<TierStats> {
        val sql = """
            SELECT tier, COUNT(*) as cnt,
                   AVG(confidence) as avg_conf,
                   AVG(access_count) as avg_access
            FROM knowledge_entries
            GROUP BY tier
        """.trimIndent()
        val results = mutableListOf<TierStats>()
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(sql)
            while (rs.next()) {
                results.add(TierStats(
                    tier = rs.getString("tier"),
                    entryCount = rs.getInt("cnt"),
                    avgConfidence = rs.getDouble("avg_conf"),
                    avgAccessCount = rs.getDouble("avg_access")
                ))
            }
        }
        return results
    }

    /** Get entries eligible for promotion (high access, high confidence). */
    fun findPromotionCandidates(tier: String, minAccess: Int, minConfidence: Double): List<Long> {
        val sql = """
            SELECT id FROM knowledge_entries
            WHERE tier = ? AND access_count >= ? AND confidence >= ?
            ORDER BY access_count DESC
        """.trimIndent()
        val ids = mutableListOf<Long>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, tier)
            stmt.setInt(2, minAccess)
            stmt.setDouble(3, minConfidence)
            val rs = stmt.executeQuery()
            while (rs.next()) ids.add(rs.getLong("id"))
        }
        return ids
    }

    private fun lastInsertId(): Long {
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT last_insert_rowid()")
            rs.next()
            return rs.getLong(1)
        }
    }

    private fun mapRow(rs: ResultSet) = ConsolidationRecord(
        id = rs.getLong("id"),
        entryId = rs.getLong("entry_id"),
        fromTier = rs.getString("from_tier"),
        toTier = rs.getString("to_tier"),
        reason = rs.getString("reason"),
        consolidatedAt = rs.getString("consolidated_at")
    )
}
