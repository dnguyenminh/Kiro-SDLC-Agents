/** ONNX Runtime embedding provider for all-MiniLM-L6-v2. */
package com.codeintel.memory.embedding

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.codeintel.log
import java.nio.LongBuffer
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.math.sqrt

class OnnxEmbeddingProvider(
    private val modelPath: Path,
    private val vocabPath: Path
) : EmbeddingProvider {

    override val modelName = "all-MiniLM-L6-v2"
    override val dimensions = 384

    private var env: OrtEnvironment? = null
    private var session: OrtSession? = null
    private var tokenizer: Tokenizer? = null
    private val maxSeqLength = 128

    /** Lazy initialization — loads model on first use. */
    private fun ensureLoaded() {
        if (session != null) return
        require(modelPath.exists()) { "ONNX model not found: $modelPath" }
        env = OrtEnvironment.getEnvironment()
        session = env!!.createSession(modelPath.toString())
        tokenizer = Tokenizer(vocabPath)
        log("ONNX model loaded: $modelPath")
    }

    override fun embed(text: String): FloatArray? {
        return try {
            ensureLoaded()
            runInference(text)
        } catch (e: Exception) {
            log("ONNX embed error: ${e.message}")
            null
        }
    }

    override fun embedBatch(texts: List<String>): List<FloatArray?> {
        return texts.map { embed(it) }
    }

    override fun isAvailable(): Boolean {
        return modelPath.exists() && vocabPath.exists()
    }

    override fun close() {
        session?.close()
        env?.close()
        session = null
        env = null
    }

    private fun runInference(text: String): FloatArray {
        val ortEnv = env ?: error("Not initialized")
        val ortSession = session ?: error("Not initialized")
        val tok = tokenizer ?: error("Not initialized")
        val encoded = tok.encode(text, maxSeqLength)
        val inputs = createTensors(ortEnv, encoded)
        val result = ortSession.run(inputs)
        val output = extractPooledOutput(result)
        inputs.values.forEach { (it as OnnxTensor).close() }
        result.close()
        return normalize(output)
    }

    private fun createTensors(
        ortEnv: OrtEnvironment,
        input: TokenizedInput
    ): Map<String, OnnxTensor> {
        val shape = longArrayOf(1, maxSeqLength.toLong())
        return mapOf(
            "input_ids" to OnnxTensor.createTensor(
                ortEnv, LongBuffer.wrap(input.inputIds), shape
            ),
            "attention_mask" to OnnxTensor.createTensor(
                ortEnv, LongBuffer.wrap(input.attentionMask), shape
            ),
            "token_type_ids" to OnnxTensor.createTensor(
                ortEnv, LongBuffer.wrap(input.tokenTypeIds), shape
            )
        )
    }

    private fun extractPooledOutput(result: OrtSession.Result): FloatArray {
        val tensor = result.get(0).value
        // Output shape: [1, seq_len, 384] — mean pooling over seq_len
        @Suppress("UNCHECKED_CAST")
        val output3d = tensor as Array<Array<FloatArray>>
        return meanPool(output3d[0])
    }

    private fun meanPool(tokenEmbeddings: Array<FloatArray>): FloatArray {
        val dim = tokenEmbeddings[0].size
        val pooled = FloatArray(dim)
        var count = 0
        for (embedding in tokenEmbeddings) {
            if (embedding.any { it != 0f }) {
                for (i in 0 until dim) pooled[i] += embedding[i]
                count++
            }
        }
        if (count > 0) for (i in 0 until dim) pooled[i] /= count
        return pooled
    }

    private fun normalize(vector: FloatArray): FloatArray {
        val norm = sqrt(vector.sumOf { (it * it).toDouble() }).toFloat()
        if (norm == 0f) return vector
        return FloatArray(vector.size) { vector[it] / norm }
    }
}
