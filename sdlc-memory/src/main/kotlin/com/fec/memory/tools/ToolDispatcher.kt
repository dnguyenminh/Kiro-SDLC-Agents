package com.fec.memory.tools

import com.fec.memory.graph.KnowledgeGraph
import com.fec.memory.search.HybridSearch
import com.fec.memory.storage.MemoryEntry
import com.fec.memory.storage.MemoryRepository
import kotlinx.serialization.json.*
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

/**
 * Dispatches MCP tool calls to appropriate handlers.
 */
class ToolDispatcher(
    private val repository: MemoryRepository,
    private val search: HybridSearch,
    private val graph: KnowledgeGraph,
) {
    fun dispatch(name: String, args: JsonObject): String {
        return when (name) {
            "memory_ingest" -> handleIngest(args)
            "memory_observe" -> handleObserve(args)
            "memory_recall" -> handleRecall(args)
            "memory_decide" -> handleDecide(args)
            "memory_error" -> handleError(args)
            "memory_handoff" -> handleHandoff(args)
            "memory_consolidate" -> handleConsolidate(args)
            "memory_stats" -> handleStats(args)
            "memory_graph" -> handleGraph(args)
            else -> "Unknown tool: $name"
        }
    }

    private fun handleIngest(args: JsonObject): String {
        val entry = MemoryEntry(
            tier = "working",
            ticketKey = args.str("ticket_key"),
            agent = args.str("agent"),
            category = args.str("category") ?: "general",
            title = args.str("title") ?: "Untitled",
            content = args.str("content") ?: "",
            importance = args.num("importance") ?: 0.5,
        )
        val id = repository.insert(entry)
        return "Memory stored (id=$id, tier=working, category=${entry.category})"
    }

    private fun handleObserve(args: JsonObject): String {
        val entry = MemoryEntry(
            tier = "episodic",
            ticketKey = args.str("ticket_key"),
            agent = args.str("agent"),
            category = "observation",
            title = "Observation",
            content = args.str("observation") ?: "",
            importance = 0.3,
        )
        val id = repository.insert(entry)
        return "Observation recorded (id=$id)"
    }

    private fun handleRecall(args: JsonObject): String {
        val query = args.str("query") ?: return "query is required"
        val limit = args.num("limit")?.toInt() ?: 10
        val results = search.search(query, args.str("ticket_key"), args.str("agent"), limit)
        if (results.isEmpty()) return "No memories found for: $query"
        val lines = mutableListOf("Found ${results.size} memories:")
        results.forEach { r ->
            lines.add("[${r.entry.tier}] ${r.entry.title} (score=${String.format("%.3f", r.score)})")
            lines.add("  ${r.entry.content.take(200)}")
            lines.add("")
        }
        return lines.joinToString("
")
    }

    private fun handleDecide(args: JsonObject): String {
        val entry = MemoryEntry(
            tier = "semantic",
            ticketKey = args.str("ticket_key"),
            agent = args.str("agent"),
            category = "decision",
            title = "Decision: ${args.str("decision_type")}",
            content = "${args.str("context")}
Chosen: ${args.str("chosen")}
Rationale: ${args.str("rationale")}",
            importance = 0.8,
        )
        val id = repository.insert(entry)
        return "Decision recorded (id=$id, type=${args.str("decision_type")})"
    }

    private fun handleError(args: JsonObject): String {
        val entry = MemoryEntry(
            tier = "procedural",
            ticketKey = args.str("ticket_key"),
            agent = args.str("agent"),
            category = "error_pattern",
            title = "Error: ${args.str("error_type")}",
            content = "Pattern: ${args.str("pattern")}
Resolution: ${args.str("resolution")}",
            importance = 0.7,
        )
        val id = repository.insert(entry)
        return "Error pattern recorded (id=$id, type=${args.str("error_type")})"
    }

    private fun handleHandoff(args: JsonObject): String {
        val entry = MemoryEntry(
            tier = "episodic",
            ticketKey = args.str("ticket_key"),
            agent = args.str("from_agent"),
            category = "handoff",
            title = "Handoff: ${args.str("from_agent")} -> ${args.str("to_agent")}",
            content = args.str("context_summary") ?: "",
            importance = 0.9,
        )
        val id = repository.insert(entry)
        return "Handoff recorded (id=$id, ${args.str("from_agent")} -> ${args.str("to_agent")})"
    }

    private fun handleConsolidate(args: JsonObject): String {
        // Placeholder: consolidation logic
        return "Consolidation triggered (tier=${args.str("tier") ?: "all"})"
    }

    private fun handleStats(args: JsonObject): String {
        val stats = repository.getStats()
        val lines = mutableListOf("Memory Statistics:")
        lines.add("  Total memories: ${stats["total"]}")
        @Suppress("UNCHECKED_CAST")
        val byTier = stats["byTier"] as Map<String, Int>
        byTier.forEach { (tier, count) -> lines.add("  $tier: $count") }
        lines.add("  Graph nodes: ${graph.nodeCount()}")
        lines.add("  Graph edges: ${graph.edgeCount()}")
        return lines.joinToString("
")
    }

    private fun handleGraph(args: JsonObject): String {
        val memId = args.num("memory_id")?.toLong()
        if (memId != null) {
            val relations = graph.getRelations(memId)
            if (relations.isEmpty()) return "No relations for memory $memId"
            val lines = mutableListOf("Relations for memory $memId:")
            relations.forEach { r ->
                lines.add("  -> [${r.relation}] memory ${r.targetId} (weight=${r.weight})")
            }
            return lines.joinToString("
")
        }
        return "Provide memory_id to query graph"
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.jsonPrimitive?.contentOrNull

    private fun JsonObject.num(key: String): Double? =
        this[key]?.jsonPrimitive?.doubleOrNull
}
