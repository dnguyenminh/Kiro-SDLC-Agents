/**
 * ModelManager — MCP tool for model lifecycle (list, download, status, switch).
 */
package com.codeintel.orchestration.models

import com.codeintel.log
import kotlinx.serialization.json.*
import java.io.File
import java.net.URL
import kotlin.concurrent.thread

class ModelManager(modelsDir: String? = null) {
    private val dir = modelsDir ?: "${System.getProperty("user.home")}/.code-intel/models"
    private val registry = ModelRegistry(dir)
    private val downloading = mutableSetOf<String>()
    private val json = Json { encodeDefaults = true }

    /** Handle action: list, download, status, switch. */
    fun execute(args: JsonObject): String {
        val action = args["action"]?.jsonPrimitive?.content?.lowercase() ?: ""
        return when (action) {
            "list" -> handleList()
            "download" -> handleDownload(args)
            "status" -> handleStatus()
            "switch" -> handleSwitch(args)
            else -> errorJson("INVALID_ACTION", "Use: list, download, status, switch")
        }
    }

    fun getActiveModel(): String = registry.activeModel
    fun getActiveModelPath(): String = registry.modelPath(registry.activeModel)

    /** Background download of default model on first need. */
    fun autoDownloadIfNeeded() {
        val modelName = DEFAULT_MODEL
        val modelFile = File("${registry.modelPath(modelName)}/model.onnx")
        if (modelFile.exists()) return
        if (modelName in downloading) return
        backgroundDownload(modelName)
    }

    private fun handleList(): String {
        val models = buildJsonArray {
            for ((name, info) in listModels()) {
                addJsonObject {
                    put("name", name)
                    put("display_name", info.displayName)
                    put("size_mb", info.sizeMb)
                    putJsonArray("languages") { info.languages.forEach { add(it) } }
                    put("downloaded", registry.isDownloaded(name))
                    put("active", name == registry.activeModel)
                }
            }
        }
        return buildJsonObject { put("models", models) }.toString()
    }

    private fun handleDownload(args: JsonObject): String {
        val modelName = args["model_name"]?.jsonPrimitive?.content ?: ""
        val info = getModelInfo(modelName) ?: return errorJson("MODEL_NOT_FOUND", "Unknown: $modelName")
        backgroundDownload(modelName)
        return buildJsonObject { put("success", true); put("model", modelName); put("status", "downloading") }.toString()
    }

    private fun handleStatus(): String {
        val active = registry.activeModel
        val info = getModelInfo(active)
        return buildJsonObject {
            put("active_model", active)
            put("model_path", registry.modelPath(active))
            put("dimensions", info?.dimensions ?: 384)
        }.toString()
    }

    private fun handleSwitch(args: JsonObject): String {
        val modelName = args["model_name"]?.jsonPrimitive?.content ?: ""
        if (getModelInfo(modelName) == null) return errorJson("MODEL_NOT_FOUND", "Unknown: $modelName")
        if (!registry.isDownloaded(modelName)) return errorJson("MODEL_NOT_DOWNLOADED", "Download first")
        registry.setActive(modelName)
        return buildJsonObject { put("success", true); put("active_model", modelName) }.toString()
    }

    private fun backgroundDownload(modelName: String) {
        synchronized(downloading) {
            if (modelName in downloading) return
            downloading.add(modelName)
        }
        thread(isDaemon = true, name = "model-download-$modelName") {
            try {
                val info = getModelInfo(modelName) ?: return@thread
                log("[model-manager] Auto-downloading: $modelName")
                val modelDir = File(registry.modelPath(modelName))
                if (!modelDir.exists()) modelDir.mkdirs()
                for ((_, relPath) in info.files) {
                    val url = "${info.baseUrl}/$relPath"
                    val target = File(modelDir, File(relPath).name)
                    if (!target.exists()) downloadFile(url, target)
                }
                val size = modelDir.listFiles()?.filter { it.isFile }?.sumOf { it.length() } ?: 0L
                registry.markDownloaded(modelName, size)
                log("[model-manager] Download complete: $modelName")
            } finally {
                synchronized(downloading) { downloading.remove(modelName) }
            }
        }
    }

    private fun downloadFile(url: String, target: File) {
        URL(url).openStream().use { input -> target.outputStream().use { output -> input.copyTo(output) } }
    }

    private fun errorJson(code: String, msg: String): String =
        buildJsonObject { put("error", code); put("message", msg) }.toString()
}
