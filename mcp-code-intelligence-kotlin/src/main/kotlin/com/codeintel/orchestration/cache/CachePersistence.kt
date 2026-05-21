/**
 * DebouncedPersistence — coalesces rapid writes into one file I/O operation.
 */
package com.codeintel.orchestration.cache

import com.codeintel.log
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.util.*
import kotlin.concurrent.schedule

class CachePersistence(
    private val filePath: String,
    private val debounceMs: Long = 5000L
) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private var timer: TimerTask? = null
    private var pendingData: String? = null
    private val lock = Any()

    /** Schedule a debounced write. Resets timer on each call. */
    fun scheduleWrite(data: String) {
        synchronized(lock) {
            pendingData = data
            timer?.cancel()
            timer = Timer("cache-persist", true).schedule(debounceMs) { doWrite() }
        }
    }

    /** Force immediate write if pending. */
    fun flush() {
        synchronized(lock) {
            timer?.cancel()
            timer = null
        }
        doWrite()
    }

    /** Load JSON from file. Returns null if missing or corrupt. */
    fun load(): Map<String, Any?>? {
        val file = File(filePath)
        if (!file.exists()) return null
        return try {
            val text = file.readText(Charsets.UTF_8)
            val element = Json.parseToJsonElement(text)
            jsonToMap(element.jsonObject)
        } catch (e: Exception) {
            log("[cache-persist] Load failed ($filePath): ${e.message}")
            null
        }
    }

    private fun doWrite() {
        val data: String?
        synchronized(lock) {
            data = pendingData
            pendingData = null
            timer = null
        }
        if (data == null) return
        try {
            val file = File(filePath)
            file.parentFile?.mkdirs()
            file.writeText(data, Charsets.UTF_8)
        } catch (e: Exception) {
            log("[cache-persist] Write failed ($filePath): ${e.message}")
        }
    }

    private fun jsonToMap(obj: JsonObject): Map<String, Any?> {
        return obj.entries.associate { (k, v) -> k to parseJsonValue(v) }
    }

    private fun parseJsonValue(v: kotlinx.serialization.json.JsonElement): Any? {
        return when (v) {
            is kotlinx.serialization.json.JsonPrimitive -> {
                v.content.toIntOrNull() ?: v.content.toDoubleOrNull() ?: v.content
            }
            is kotlinx.serialization.json.JsonArray -> v.map { parseJsonValue(it) }
            is JsonObject -> v.entries.associate { (k, e) -> k to parseJsonValue(e) }
            else -> null
        }
    }
}
