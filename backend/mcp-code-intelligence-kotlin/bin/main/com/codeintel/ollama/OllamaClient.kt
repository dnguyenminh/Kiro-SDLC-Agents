/** Optional Ollama HTTP client for semantic embeddings. */
package com.codeintel.ollama

import com.codeintel.log
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

@Serializable
data class EmbeddingRequest(val model: String, val prompt: String)

@Serializable
data class EmbeddingResponse(val embedding: List<Double>)

class OllamaClient(private val baseUrl: String, private val model: String) {
    private val client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build()
    private val json = Json { ignoreUnknownKeys = true }

    /** Generate embedding for text. Returns null on failure. */
    fun embed(text: String): List<Double>? {
        val body = json.encodeToString(EmbeddingRequest.serializer(), EmbeddingRequest(model, text))
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$baseUrl/api/embeddings"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofSeconds(30))
            .build()
        return try {
            val response = client.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() != 200) return null
            json.decodeFromString(EmbeddingResponse.serializer(), response.body()).embedding
        } catch (e: Exception) {
            log("Ollama error: ${e.message}")
            null
        }
    }

    /** Check if Ollama is reachable. */
    fun isAvailable(): Boolean {
        return try {
            val req = HttpRequest.newBuilder()
                .uri(URI.create("$baseUrl/api/tags"))
                .timeout(Duration.ofSeconds(5))
                .GET().build()
            client.send(req, HttpResponse.BodyHandlers.ofString()).statusCode() == 200
        } catch (_: Exception) { false }
    }
}
