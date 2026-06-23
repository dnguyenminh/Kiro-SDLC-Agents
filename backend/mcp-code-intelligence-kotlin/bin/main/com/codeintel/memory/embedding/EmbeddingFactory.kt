/** Factory for creating EmbeddingService — tries ONNX (default), then Ollama. */
package com.codeintel.memory.embedding

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.memory.repository.VectorRepository
import com.codeintel.ollama.OllamaClient
import java.nio.file.Path
import kotlin.io.path.exists

object EmbeddingFactory {

    /** Create EmbeddingService: ONNX (default) → Ollama (if configured) → null. */
    fun create(config: Config, vectorRepo: VectorRepository): EmbeddingService? {
        // Priority 1: Ollama (if explicitly configured)
        val ollamaService = tryOllama(config, vectorRepo)
        if (ollamaService != null) return ollamaService

        // Priority 2: Local ONNX model (all-MiniLM-L6-v2)
        val onnxService = tryOnnx(config, vectorRepo)
        if (onnxService != null) return onnxService

        return null
    }

    private fun tryOllama(config: Config, vectorRepo: VectorRepository): EmbeddingService? {
        val url = config.ollamaUrl ?: return null
        val client = OllamaClient(url, config.ollamaModel)
        if (!client.isAvailable()) {
            log("⚠️ Ollama configured but not reachable at $url")
            return null
        }
        val provider = OllamaEmbeddingProvider(client, config.ollamaModel)
        log("✅ Embedding: Ollama (${config.ollamaModel}) at $url")
        return EmbeddingService(provider, vectorRepo)
    }

    private fun tryOnnx(config: Config, vectorRepo: VectorRepository): EmbeddingService? {
        val modelPath = resolveModelPath(config.workspace)
        val vocabPath = resolveVocabPath(config.workspace)
        if (modelPath == null || vocabPath == null) {
            log("⚠️ ONNX model not found. Download: all-MiniLM-L6-v2 model.onnx + vocab.txt to .code-intel/models/")
            return null
        }
        return try {
            val provider = OnnxEmbeddingProvider(modelPath, vocabPath)
            if (!provider.isAvailable()) return null
            log("✅ Embedding: ONNX local (all-MiniLM-L6-v2, 384d)")
            EmbeddingService(provider, vectorRepo)
        } catch (e: Exception) {
            log("⚠️ ONNX init failed: ${e.message}")
            null
        }
    }

    private fun resolveModelPath(workspace: String): Path? {
        val candidates = listOf(
            Path.of(workspace, ".code-intel", "models", "model.onnx"),
            Path.of(workspace, ".code-intel", "models", "all-MiniLM-L6-v2.onnx"),
            Path.of(System.getProperty("user.home"), ".code-intel", "models", "model.onnx")
        )
        return candidates.firstOrNull { it.exists() }
    }

    private fun resolveVocabPath(workspace: String): Path? {
        val candidates = listOf(
            Path.of(workspace, ".code-intel", "models", "vocab.txt"),
            Path.of(System.getProperty("user.home"), ".code-intel", "models", "vocab.txt")
        )
        return candidates.firstOrNull { it.exists() }
    }
}
