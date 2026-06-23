/**
 * SSE (Server-Sent Events) handler for real-time KB change notifications.
 * Endpoint: GET /api/events
 * Protocol: text/event-stream with keepalive every 30s.
 */
package com.codeintel.http

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import java.util.concurrent.CopyOnWriteArrayList

/** KB event types that trigger panel updates. */
enum class KbEventType(val value: String) {
    KB_ENTRY_ADDED("kb_entry_added"),
    KB_ENTRY_UPDATED("kb_entry_updated"),
    KB_ENTRY_DELETED("kb_entry_deleted"),
    TAG_CREATED("tag_created"),
    TAG_DELETED("tag_deleted"),
    TAG_UPDATED("tag_updated"),
    QUALITY_SCORED("quality_scored"),
    BULK_OPERATION("bulk_operation"),
    CONSOLIDATION_COMPLETE("consolidation_complete")
}

@Serializable
data class KbEvent(
    val type: String,
    val timestamp: Long,
    val data: Map<String, String?> = emptyMap()
)

/**
 * Singleton KB event emitter. Thread-safe via CopyOnWriteArrayList.
 * MCP tool handlers call emit() after successful write operations.
 */
object KbEventEmitter {
    private val subscribers = CopyOnWriteArrayList<Channel<KbEvent>>()

    /** Emit event to all subscribers. */
    fun emit(type: KbEventType, data: Map<String, String?> = emptyMap()) {
        val event = KbEvent(type.value, System.currentTimeMillis(), data)
        for (ch in subscribers) {
            ch.trySend(event)
        }
    }

    /** Create a new subscription channel. Returns pair of (channel, unsubscribe). */
    fun subscribe(): Pair<Channel<KbEvent>, () -> Unit> {
        val ch = Channel<KbEvent>(Channel.BUFFERED)
        subscribers.add(ch)
        val unsubscribe: () -> Unit = {
            subscribers.remove(ch)
            ch.close()
            Unit
        }
        return ch to unsubscribe
    }

    /** Get active subscriber count. */
    fun connectionCount(): Int = subscribers.size
}

/** Install SSE route under /api/events. */
fun Route.sseEventsRoute() {
    get("/api/events") {
        call.response.cacheControl(CacheControl.NoCache(null))
        call.respondTextWriter(ContentType.Text.EventStream) {
            // Initial connected event
            write("event: connected\ndata: ${Json.encodeToString(KbEvent("connected", System.currentTimeMillis()))}\n\n")
            flush()

            val (channel, unsubscribe) = KbEventEmitter.subscribe()
            try {
                // Keepalive via coroutine
                val keepaliveJob = CoroutineScope(Dispatchers.IO).launch {
                    while (isActive) {
                        delay(30_000)
                        try { write(": keepalive\n\n"); flush() }
                        catch (_: Exception) { break }
                    }
                }

                // Event push loop
                for (event in channel) {
                    try {
                        write("event: ${event.type}\ndata: ${Json.encodeToString(event)}\n\n")
                        flush()
                    } catch (_: Exception) {
                        break
                    }
                }
                keepaliveJob.cancel()
            } finally {
                unsubscribe()
            }
        }
    }
}

/** Infer event type from tool name + action. Returns null for reads. */
fun inferKbEvent(toolName: String, args: Map<String, Any?>?): KbEventType? {
    val action = (args?.get("action") as? String) ?: ""
    return when (toolName) {
        "mem_ingest", "mem_ingest_file" -> KbEventType.KB_ENTRY_ADDED
        "mem_crud" -> when (action) {
            "delete" -> KbEventType.KB_ENTRY_DELETED
            "update" -> KbEventType.KB_ENTRY_UPDATED
            else -> null
        }
        "mem_tags" -> when (action) {
            "create" -> KbEventType.TAG_CREATED
            "delete" -> KbEventType.TAG_DELETED
            "tag", "untag" -> KbEventType.TAG_UPDATED
            else -> null
        }
        "mem_scoring" -> when (action) {
            "quality_score", "feedback_submit" -> KbEventType.QUALITY_SCORED
            else -> null
        }
        "mem_lifecycle" -> when (action) {
            "archive", "unarchive", "mark_reviewed" -> KbEventType.KB_ENTRY_UPDATED
            else -> null
        }
        "mem_consolidate" -> KbEventType.CONSOLIDATION_COMPLETE
        else -> null
    }
}
