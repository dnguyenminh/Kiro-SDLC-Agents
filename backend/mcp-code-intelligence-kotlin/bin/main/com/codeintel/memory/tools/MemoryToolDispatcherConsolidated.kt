/** Consolidated dispatcher — routes 14 tools + backward-compatible aliases. KSA-85. */
package com.codeintel.memory.tools

import com.codeintel.http.KbEventEmitter
import com.codeintel.http.inferKbEvent
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonPrimitive

class MemoryToolDispatcherConsolidated(
    private val v1: MemoryToolDispatcher,
    private val v2: MemoryToolDispatcherV2
) {
    /** Dispatch tool call. Handles new names + aliases. Returns null if not handled. */
    fun dispatch(name: String, args: JsonObject): String? {
        val (resolved, merged) = resolveAlias(name, args)
        val result = HANDLERS[resolved]?.invoke(this, merged) ?: return null
        // Emit SSE event for write operations
        if (!result.startsWith("Error:")) {
            val action = merged["action"]?.jsonPrimitive?.content
            val eventType = inferKbEvent(resolved, mapOf("action" to action))
            if (eventType != null) {
                KbEventEmitter.emit(eventType, mapOf("tool" to resolved, "action" to action))
            }
        }
        return result
    }

    private fun resolveAlias(name: String, args: JsonObject): Pair<String, JsonObject> {
        val alias = ALIASES[name] ?: return name to args
        val (newName, defaults) = alias
        val merged = buildJsonObject {
            defaults.forEach { (k, v) -> put(k, v) }
            args.forEach { (k, v) -> put(k, v) }
        }
        return newName to merged
    }

    // --- Routing to V1/V2 ---

    internal fun routeV1(toolName: String, args: JsonObject): String {
        return v1.dispatch(toolName, args) ?: "Error: $toolName failed"
    }

    internal fun routeV2(toolName: String, args: JsonObject): String {
        return v2.dispatch(toolName, args) ?: "Error: $toolName failed"
    }

    companion object {
        private val ALIASES: Map<String, Pair<String, Map<String, String>>> = mapOf(
            "mem_get" to ("mem_crud" to mapOf("action" to "get")),
            "mem_delete" to ("mem_crud" to mapOf("action" to "delete")),
            "mem_list" to ("mem_crud" to mapOf("action" to "list")),
            "mem_status" to ("mem_admin" to mapOf("action" to "status")),
            "mem_audit" to ("mem_admin" to mapOf("action" to "audit")),
            "mem_sessions" to ("mem_admin" to mapOf("action" to "sessions")),
            "mem_sync_code" to ("mem_admin" to mapOf("action" to "sync_code")),
            "mem_consolidate_v2" to ("mem_consolidate" to emptyMap()),
            "mem_stale" to ("mem_lifecycle" to mapOf("action" to "detect_stale")),
            "mem_due_reviews" to ("mem_lifecycle" to mapOf("action" to "due_reviews")),
            "mem_review" to ("mem_lifecycle" to emptyMap()),
            "mem_reminders" to ("mem_lifecycle" to emptyMap()),
            "mem_suggest" to ("mem_discover" to mapOf("action" to "suggest")),
            "mem_related" to ("mem_discover" to mapOf("action" to "related")),
            "mem_cite" to ("mem_citations" to mapOf("action" to "record")),
            "mem_quality" to ("mem_scoring" to emptyMap()),
            "mem_confidence" to ("mem_scoring" to emptyMap()),
            "mem_feedback" to ("mem_scoring" to emptyMap()),
            "mem_analytics" to ("mem_admin" to mapOf("action" to "analytics")),
            "mem_dashboard" to ("mem_admin" to mapOf("action" to "dashboard")),
        )

        private val HANDLERS: Map<String, (MemoryToolDispatcherConsolidated, JsonObject) -> String> = mapOf(
            "mem_search" to { d, a -> d.routeV1("mem_search", a) },
            "mem_ingest" to { d, a -> d.routeV1("mem_ingest", a) },
            "mem_ingest_file" to { d, a -> d.routeV1("mem_ingest_file", a) },
            "mem_crud" to ::handleCrud,
            "mem_graph" to { d, a -> d.routeV1("mem_graph", a) },
            "mem_consolidate" to { d, a -> d.routeV2("mem_consolidate_v2", a) },
            "mem_lifecycle" to ::handleLifecycle,
            "mem_templates" to { d, a -> d.routeV2("mem_templates", a) },
            "mem_attachments" to { d, a -> d.routeV2("mem_attachments", a) },
            "mem_discover" to ::handleDiscover,
            "mem_tags" to { d, a -> d.routeV2("mem_tags", a) },
            "mem_citations" to ::handleCitations,
            "mem_scoring" to ::handleScoring,
            "mem_admin" to ::handleAdmin,
        )

        private fun handleCrud(d: MemoryToolDispatcherConsolidated, a: JsonObject): String {
            val action = a.str("action") ?: "list"
            val v1Name = when (action) {
                "get" -> "mem_get"
                "delete" -> "mem_delete"
                else -> "mem_list"
            }
            return d.routeV1(v1Name, a)
        }

        private fun handleLifecycle(d: MemoryToolDispatcherConsolidated, a: JsonObject): String {
            val action = a.str("action") ?: "detect_stale"
            return when (action) {
                "detect_stale" -> d.routeV2("mem_stale", a.withAction("detect"))
                "archive" -> d.routeV2("mem_stale", a.withAction("archive"))
                "unarchive" -> d.routeV2("mem_stale", a.withAction("unarchive"))
                "due_reviews" -> d.routeV2("mem_due_reviews", a)
                "mark_reviewed" -> d.routeV2("mem_review", a.withAction("mark_reviewed"))
                "schedule" -> d.routeV2("mem_reminders", a.withAction("schedule"))
                "snooze" -> d.routeV2("mem_reminders", a.withAction("snooze"))
                "complete" -> d.routeV2("mem_reminders", a.withAction("complete"))
                else -> "Error: unknown lifecycle action: $action"
            }
        }

        private fun handleDiscover(d: MemoryToolDispatcherConsolidated, a: JsonObject): String {
            val action = a.str("action") ?: "suggest"
            return if (action == "related") d.routeV2("mem_related", a)
            else d.routeV2("mem_suggest", a)
        }

        private fun handleCitations(d: MemoryToolDispatcherConsolidated, a: JsonObject): String {
            val action = a.str("action") ?: "most_cited"
            return if (action == "record") d.routeV2("mem_cite", a)
            else d.routeV2("mem_citations", a.withAction(action))
        }

        private fun handleScoring(d: MemoryToolDispatcherConsolidated, a: JsonObject): String {
            val action = a.str("action") ?: "quality_stats"
            return when (action) {
                "quality_score" -> d.routeV2("mem_quality", a.withAction("score"))
                "quality_stats" -> d.routeV2("mem_quality", a.withAction("stats"))
                "low_quality" -> d.routeV2("mem_quality", a.withAction("low_quality"))
                "validate" -> d.routeV2("mem_quality", a.withAction("validate"))
                "confidence" -> d.routeV2("mem_confidence", a.withAction("compute"))
                "confidence_stats" -> d.routeV2("mem_confidence", a.withAction("stats"))
                "unreliable" -> d.routeV2("mem_confidence", a.withAction("unreliable"))
                "feedback_submit" -> d.routeV2("mem_feedback", a.withAction("submit"))
                "feedback_view" -> d.routeV2("mem_feedback", a.withAction("summary"))
                "top_rated" -> d.routeV2("mem_feedback", a.withAction("top_rated"))
                "low_rated" -> d.routeV2("mem_feedback", a.withAction("low_rated"))
                else -> "Error: unknown scoring action: $action"
            }
        }

        private fun handleAdmin(d: MemoryToolDispatcherConsolidated, a: JsonObject): String {
            val action = a.str("action") ?: "status"
            return when (action) {
                "status" -> d.routeV1("mem_status", a)
                "audit" -> d.routeV1("mem_audit", a)
                "sessions" -> d.routeV1("mem_sessions", a)
                "sync_code" -> d.routeV1("mem_sync_code", a)
                "analytics" -> d.routeV2("mem_analytics", a.withAction("summary"))
                "popular" -> d.routeV2("mem_analytics", a.withAction("popular"))
                "gaps" -> d.routeV2("mem_analytics", a.withAction("gaps"))
                "zero_results" -> d.routeV2("mem_analytics", a.withAction("zero_results"))
                "dashboard" -> d.routeV2("mem_dashboard", a.withAction("full"))
                "metrics" -> d.routeV2("mem_dashboard", a.withAction("metrics"))
                "recommendations" -> d.routeV2("mem_dashboard", a.withAction("recommendations"))
                "trends" -> d.routeV2("mem_dashboard", a.withAction("trends"))
                else -> "Error: unknown admin action: $action"
            }
        }

        // --- Extension helpers ---

        private fun JsonObject.str(key: String): String? =
            this[key]?.jsonPrimitive?.content

        private fun JsonObject.withAction(action: String): JsonObject = buildJsonObject {
            this@withAction.forEach { (k, v) -> put(k, v) }
            put("action", action)
        }
    }
}
