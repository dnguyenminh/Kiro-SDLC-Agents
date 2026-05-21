/**
 * Model catalog — known embedding models with metadata.
 */
package com.codeintel.orchestration.models

data class ModelInfo(
    val displayName: String,
    val sizeMb: Int,
    val languages: List<String>,
    val vocabSize: Int,
    val dimensions: Int,
    val baseUrl: String,
    val files: Map<String, String>
)

val MODELS: Map<String, ModelInfo> = mapOf(
    "all-MiniLM-L6-v2" to ModelInfo(
        displayName = "English (Small, Fast)",
        sizeMb = 90,
        languages = listOf("en"),
        vocabSize = 30522,
        dimensions = 384,
        baseUrl = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main",
        files = mapOf("model" to "onnx/model.onnx", "vocab" to "vocab.txt")
    ),
    "paraphrase-multilingual-MiniLM-L12-v2" to ModelInfo(
        displayName = "Multilingual (50+ languages)",
        sizeMb = 470,
        languages = listOf("en", "vi", "zh", "ja", "ko", "fr", "de", "es", "ar", "ru"),
        vocabSize = 250002,
        dimensions = 384,
        baseUrl = "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main",
        files = mapOf("model" to "onnx/model.onnx", "vocab" to "sentencepiece.bpe.model")
    )
)

const val DEFAULT_MODEL = "all-MiniLM-L6-v2"

/** Get model metadata by name. */
fun getModelInfo(name: String): ModelInfo? = MODELS[name]

/** List all known models with metadata. */
fun listModels(): List<Pair<String, ModelInfo>> = MODELS.entries.map { it.key to it.value }
