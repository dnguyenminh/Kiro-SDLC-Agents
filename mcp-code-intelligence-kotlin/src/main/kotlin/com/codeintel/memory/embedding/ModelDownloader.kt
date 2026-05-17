/** Downloads ONNX model and vocab files if not present locally. */
package com.codeintel.memory.embedding

import com.codeintel.log
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Path
import java.time.Duration
import kotlin.io.path.createDirectories
import kotlin.io.path.exists

/** Handles model file download and path resolution. */
class ModelDownloader(private val modelsDir: Path) {

    private val modelFileName = "model.onnx"
    private val vocabFileName = "vocab.txt"

    val modelPath: Path get() = modelsDir.resolve(modelFileName)
    val vocabPath: Path get() = modelsDir.resolve(vocabFileName)

    /** Check if model files exist locally. */
    fun isModelPresent(): Boolean = modelPath.exists() && vocabPath.exists()

    /** Download model files from HuggingFace. Returns true on success. */
    fun downloadIfMissing(): Boolean {
        if (isModelPresent()) return true
        modelsDir.createDirectories()
        val baseUrl = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main"
        val success = downloadFile("$baseUrl/onnx/model.onnx", modelPath) &&
            downloadFile("$baseUrl/vocab.txt", vocabPath)
        if (success) log("Model downloaded to $modelsDir")
        return success
    }

    private fun downloadFile(url: String, target: Path): Boolean {
        if (target.exists()) return true
        log("Downloading: $url")
        return try {
            val client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(30))
                .build()
            val request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(5))
                .GET().build()
            val response = client.send(request, HttpResponse.BodyHandlers.ofFile(target))
            response.statusCode() == 200
        } catch (e: Exception) {
            log("Download failed: ${e.message}")
            false
        }
    }
}
