/**
 * KSA-142 F1/F2/F3 tool handlers — extracted from MemoryToolDispatcher to keep file < 200 lines.
 * Handles mem_pin, mem_conversation, mem_map tool calls.
 */
package com.codeintel.memory.tools

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.conversation.ConversationRepository
import com.codeintel.memory.conversation.ConversationSummarizer
import com.codeintel.memory.core.CoreMemoryManager
import com.codeintel.memory.map.EntityRepository
import com.codeintel.memory.map.StructuredMapExtractor
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Handle mem_pin tool actions. */
fun handlePin(engine: MemoryEngine, args: JsonObject): String {
    val mgr = CoreMemoryManager(engine.connection)
    val action = args["action"]?.jsonPrimitive?.content ?: "list"
    val entryId = args["entry_id"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
    return when (action) {
        "pin" -> mgr.pin(entryId)
        "unpin" -> mgr.unpin(entryId)
        "list" -> {
            val pinned = mgr.listPinned()
            if (pinned.isEmpty()) "No pinned entries"
            else buildString {
                appendLine("Pinned entries (${pinned.size}):")
                pinned.forEach {
                    appendLine("  #${it.id} (order=${it.pinOrder}, ~${it.tokens} tokens): ${it.summary.take(80)}")
                }
            }
        }
        "reorder" -> {
            val order = args["order"]?.jsonPrimitive?.content?.toIntOrNull() ?: 1
            mgr.reorder(entryId, order)
        }
        "get_context" -> mgr.getContext().ifEmpty { "No pinned context" }
        "budget" -> {
            val status = mgr.getBudgetStatus()
            "Budget: ${status.used}/${status.max} tokens used, ${status.remaining} remaining" +
                if (status.warning) " ⚠️ WARNING" else ""
        }
        else -> "Unknown action: $action"
    }
}

/** Handle mem_conversation tool actions. */
fun handleConversation(engine: MemoryEngine, args: JsonObject): String {
    val repo = ConversationRepository(engine.connection)
    val action = args["action"]?.jsonPrimitive?.content ?: "list_sessions"
    return when (action) {
        "save_turn" -> {
            val sessionId = args["session_id"]?.jsonPrimitive?.content
            val role = args["role"]?.jsonPrimitive?.content ?: "user"
            val content = args["content"]?.jsonPrimitive?.content ?: ""
            val id = repo.saveTurn(sessionId, role, content)
            "Saved turn $id (session=${sessionId ?: "auto"}, role=$role)"
        }
        "get_session" -> {
            val sessionId = args["session_id"]?.jsonPrimitive?.content ?: ""
            val limit = args["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 100
            val turns = repo.getSession(sessionId, limit)
            if (turns.isEmpty()) "No turns found for session: $sessionId"
            else buildString {
                appendLine("Session $sessionId (${turns.size} turns):")
                turns.forEach { appendLine("  [${it.role}] ${it.content.take(120)}") }
            }
        }
        "list_sessions" -> {
            val limit = args["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 20
            val sessions = repo.listSessions(limit)
            if (sessions.isEmpty()) "No conversation sessions found"
            else buildString {
                appendLine("Sessions (${sessions.size}):")
                sessions.forEach {
                    appendLine("  ${it.sessionId}: ${it.turnCount} turns, roles=${it.roles.joinToString(",")}, last=${it.lastTurnAt}")
                }
            }
        }
        "search" -> {
            val query = args["query"]?.jsonPrimitive?.content ?: ""
            val limit = args["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 20
            val turns = repo.searchTurns(query, limit)
            if (turns.isEmpty()) "No turns matching: $query"
            else buildString {
                appendLine("Found ${turns.size} turns matching '$query':")
                turns.forEach { appendLine("  [${it.sessionId}/${it.role}] ${it.content.take(120)}") }
            }
        }
        "summarize" -> {
            val sessionId = args["session_id"]?.jsonPrimitive?.content ?: ""
            val summarizer = ConversationSummarizer(repo, engine.knowledge)
            val result = summarizer.summarizeSession(sessionId)
                ?: return "No turns to summarize for session: $sessionId"
            "Summarized ${result.turnsProcessed} turns → entry #${result.summaryEntryId}"
        }
        else -> "Unknown action: $action"
    }
}

/** Handle mem_map tool actions. */
fun handleMap(engine: MemoryEngine, args: JsonObject): String {
    val conn = engine.connection
    val extractor = StructuredMapExtractor(conn)
    val entityRepo = EntityRepository(conn)
    val action = args["action"]?.jsonPrimitive?.content ?: "get"
    val entryId = args["entry_id"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
    return when (action) {
        "get" -> {
            val ps = conn.prepareStatement("SELECT structured_map FROM knowledge_entries WHERE id = ?")
            ps.setInt(1, entryId)
            val rs = ps.executeQuery()
            val result = if (rs.next()) rs.getString(1) ?: "{}" else "Error: entry $entryId not found"
            rs.close(); ps.close()
            result
        }
        "update" -> {
            val ps = conn.prepareStatement("SELECT structured_map FROM knowledge_entries WHERE id = ?")
            ps.setInt(1, entryId)
            val rs = ps.executeQuery()
            if (!rs.next()) { rs.close(); ps.close(); return "Error: entry $entryId not found" }
            rs.close(); ps.close()
            val mapArg = args["map"]?.toString() ?: "{}"
            conn.prepareStatement("UPDATE knowledge_entries SET structured_map = ? WHERE id = ?").use {
                it.setString(1, mapArg); it.setInt(2, entryId); it.executeUpdate()
            }
            "Updated structured map for entry $entryId"
        }
        "search_entity" -> {
            val entity = args["entity"]?.jsonPrimitive?.content ?: ""
            val limit = args["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 10
            val ids = entityRepo.findByEntity(entity, limit)
            if (ids.isEmpty()) "No entries found for entity: $entity"
            else "Entries mentioning '$entity': $ids"
        }
        "search_topic" -> {
            val topic = args["topic"]?.jsonPrimitive?.content ?: ""
            val limit = args["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 10
            val ps = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE structured_map LIKE ? LIMIT ?")
            ps.setString(1, "%$topic%"); ps.setInt(2, limit)
            val rs = ps.executeQuery()
            val ids = mutableListOf<Int>()
            while (rs.next()) ids.add(rs.getInt(1))
            rs.close(); ps.close()
            if (ids.isEmpty()) "No entries found for topic: $topic"
            else "Entries with topic '$topic': $ids"
        }
        "reextract" -> {
            val map = extractor.reExtract(entryId)
            entityRepo.indexEntities(entryId, map.entitiesMentioned)
            "Re-extracted map for entry $entryId: topic='${map.topic}', entities=${map.entitiesMentioned.size}"
        }
        else -> "Unknown action: $action"
    }
}
