/**
 * ModelRegistry — tracks downloaded models and active selection via registry.json.
 */
package com.codeintel.orchestration.models

import com.codeintel.log
import kotlinx.serialization.json.*
import java.io.File
import java.time.Instant

private const val REGISTRY_FILE = "registry.json"

class ModelRegistry(private val modelsDir: String) {
    private val filePath = "$modelsDir/$REGISTRY_FILE"
    private var data: MutableMap<String, Any?>? = null
    private val json = Json { prettyPrint = true; encodeDefaults = true }

    val activeModel: String get() {
        data = null // Invalidate cache — external tools may update registry
        return loadData()["active_model"]?.toString() ?: DEFAULT_MODEL
    }

    /** Check if a model is marked as downloaded. */
    fun isDownloaded(modelName: String): Boolean {
        val models = loadData()["models"] as? Map<*, *> ?: return false
        return modelName in models
    }

    /** Get path for a specific model. */
    fun modelPath(modelName: String): String = "$modelsDir/$modelName"

    /** Mark a model as downloaded in registry. */
    fun markDownloaded(modelName: String, sizeBytes: Long) {
        val data = loadData()
        val models = (data["models"] as? MutableMap<String, Any?>) ?: mutableMapOf()
        models[modelName] = mapOf(
            "path" to modelPath(modelName),
            "downloaded_at" to nowIso(),
            "size_bytes" to sizeBytes
        )
        data["models"] = models
        data["last_updated"] = nowIso()
        save(data)
    }

    /** Set the active model. */
    fun setActive(modelName: String) {
        val data = loadData()
        data["active_model"] = modelName
        data["last_updated"] = nowIso()
        save(data)
        log("[model-registry] Active model set to: $modelName")
    }

    @Suppress("UNCHECKED_CAST")
    private fun loadData(): MutableMap<String, Any?> {
        if (data != null) return data!!
        val file = File(filePath)
        if (!file.exists()) {
            data = mutableMapOf("active_model" to DEFAULT_MODEL, "models" to mutableMapOf<String, Any?>())
            return data!!
        }
        data = try {
            val text = file.readText(Charsets.UTF_8)
            val element = Json.parseToJsonElement(text).jsonObject
            element.entries.associate { (k, v) -> k to parseValue(v) }.toMutableMap()
        } catch (e: Exception) {
            log("[model-registry] Load failed: ${e.message}")
            mutableMapOf("active_model" to DEFAULT_MODEL, "models" to mutableMapOf<String, Any?>())
        }
        return data!!
    }

    private fun save(data: MutableMap<String, Any?>) {
        this.data = data
        try {
            val dir = File(modelsDir)
            if (!dir.exists()) dir.mkdirs()
            val obj = buildJsonObject {
                put("active_model", data["active_model"]?.toString() ?: DEFAULT_MODEL)
                put("last_updated", data["last_updated"]?.toString() ?: nowIso())
            }
            File(filePath).writeText(json.encodeToString(JsonObject.serializer(), obj), Charsets.UTF_8)
        } catch (e: Exception) {
            log("[model-registry] Save failed: ${e.message}")
        }
    }

    private fun parseValue(v: JsonElement): Any? = when (v) {
        is JsonPrimitive -> v.content
        is JsonArray -> v.map { parseValue(it) }
        is JsonObject -> v.entries.associate { (k, e) -> k to parseValue(e) }.toMutableMap()
        else -> null
    }

    private fun nowIso(): String = Instant.now().toString().replace(Regex("\\.\\d+Z$"), "Z")
}
