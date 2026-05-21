/** KSA-69: Real Consolidation Engine — Promote/Demote/Merge. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection

class KbConsolidateV2Tool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        val action = args.str("action") ?: "consolidate"
        val dryRun = args.bool("dry_run")
        if (action == "merge") return handleMerge(args, dryRun)
        return handleConsolidate(dryRun)
    }

    private fun handleConsolidate(dryRun: Boolean): String {
        val promoted = promoteEligible(dryRun)
        val demoted = demoteInactive(dryRun)
        return """{"promoted":$promoted,"demoted":$demoted,"dry_run":$dryRun}"""
    }

    private fun handleMerge(args: JsonObject, dryRun: Boolean): String {
        val survivorId = args.int("survivor_id") ?: return """{"error":"survivor_id required"}"""
        val mergeIds = (args.str("merge_ids") ?: "").split(",").mapNotNull { it.trim().toIntOrNull() }
        if (mergeIds.isEmpty()) return """{"error":"merge_ids required"}"""
        val strategy = args.str("strategy") ?: "append"
        if (dryRun) return """{"action":"merge","survivor_id":$survivorId,"merge_count":${mergeIds.size},"dry_run":true}"""
        return mergeEntries(survivorId, mergeIds, strategy)
    }

    private fun mergeEntries(survivorId: Int, mergeIds: List<Int>, strategy: String): String {
        val survivor = getContent(survivorId) ?: return """{"error":"survivor not found"}"""
        val parts = mutableListOf(survivor)
        for (id in mergeIds) {
            val c = getContent(id) ?: continue
            parts.add("\n---\n[Merged from #$id]\n$c")
        }
        val merged = if (strategy == "newest") getNewest(listOf(survivorId) + mergeIds) else parts.joinToString("\n")
        conn.prepareStatement("UPDATE knowledge_entries SET content = ?, updated_at = datetime('now') WHERE id = ?").use { it.setString(1, merged); it.setInt(2, survivorId); it.executeUpdate() }
        conn.prepareStatement("INSERT INTO merge_history (survivor_id, merged_ids, strategy) VALUES (?, ?, ?)").use { it.setInt(1, survivorId); it.setString(2, mergeIds.joinToString(",")); it.setString(3, strategy); it.executeUpdate() }
        for (id in mergeIds) conn.prepareStatement("DELETE FROM knowledge_entries WHERE id = ?").use { it.setInt(1, id); it.executeUpdate() }
        return """{"survivor_id":$survivorId,"merged_count":${mergeIds.size},"strategy":"$strategy"}"""
    }

    private fun promoteEligible(dryRun: Boolean): Int {
        var count = 0
        val thresholds = mapOf("WORKING" to Pair(3, 0.7), "EPISODIC" to Pair(10, 0.85), "SEMANTIC" to Pair(25, 0.95))
        val targets = mapOf("WORKING" to "EPISODIC", "EPISODIC" to "SEMANTIC", "SEMANTIC" to "PROCEDURAL")
        for ((tier, thresh) in thresholds) {
            val rs = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE tier = ? AND access_count >= ? AND confidence >= ? AND archived_at IS NULL").use { it.setString(1, tier); it.setInt(2, thresh.first); it.setDouble(3, thresh.second); it.executeQuery() }
            while (rs.next()) {
                if (!dryRun) transition(rs.getInt(1), tier, targets[tier]!!, "auto:promote")
                count++
            }
        }
        return count
    }

    private fun demoteInactive(dryRun: Boolean): Int {
        var count = 0
        val thresholds = mapOf("PROCEDURAL" to Pair(90, "SEMANTIC"), "SEMANTIC" to Pair(60, "EPISODIC"), "EPISODIC" to Pair(30, "WORKING"))
        for ((tier, pair) in thresholds) {
            val cutoff = java.time.Instant.now().minusSeconds(pair.first.toLong() * 86400).toString()
            val rs = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE tier = ? AND (last_accessed_at IS NULL OR last_accessed_at < ?) AND archived_at IS NULL").use { it.setString(1, tier); it.setString(2, cutoff); it.executeQuery() }
            while (rs.next()) {
                if (!dryRun) transition(rs.getInt(1), tier, pair.second, "auto:demote")
                count++
            }
        }
        return count
    }

    private fun transition(id: Int, from: String, to: String, reason: String) {
        conn.prepareStatement("UPDATE knowledge_entries SET tier = ?, updated_at = datetime('now') WHERE id = ?").use { it.setString(1, to); it.setInt(2, id); it.executeUpdate() }
        conn.prepareStatement("INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason) VALUES (?, ?, ?, ?)").use { it.setInt(1, id); it.setString(2, from); it.setString(3, to); it.setString(4, reason); it.executeUpdate() }
    }

    private fun getContent(id: Int): String? = conn.prepareStatement("SELECT content FROM knowledge_entries WHERE id = ?").use { it.setInt(1, id); val rs = it.executeQuery(); if (rs.next()) rs.getString(1) else null }

    private fun getNewest(ids: List<Int>): String {
        val placeholders = ids.joinToString(",") { "?" }
        val ps = conn.prepareStatement("SELECT content FROM knowledge_entries WHERE id IN ($placeholders) ORDER BY updated_at DESC LIMIT 1")
        ids.forEachIndexed { i, id -> ps.setInt(i + 1, id) }
        val rs = ps.executeQuery()
        return if (rs.next()) rs.getString(1) else ""
    }
}
