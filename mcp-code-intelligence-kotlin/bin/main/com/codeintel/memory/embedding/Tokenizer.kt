/** Simple WordPiece tokenizer for all-MiniLM-L6-v2 model. */
package com.codeintel.memory.embedding

import com.codeintel.log
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readLines

class Tokenizer(vocabPath: Path) {
    private val vocab: Map<String, Int>
    private val clsId: Int
    private val sepId: Int
    private val unkId: Int
    private val padId: Int

    init {
        require(vocabPath.exists()) { "Vocab file not found: $vocabPath" }
        vocab = loadVocab(vocabPath)
        clsId = vocab["[CLS]"] ?: 101
        sepId = vocab["[SEP]"] ?: 102
        unkId = vocab["[UNK]"] ?: 100
        padId = vocab["[PAD]"] ?: 0
        log("Tokenizer loaded: ${vocab.size} tokens")
    }

    /** Tokenize text into input_ids, attention_mask, token_type_ids. */
    fun encode(text: String, maxLength: Int = 128): TokenizedInput {
        val tokens = tokenize(text)
        val truncated = tokens.take(maxLength - 2)
        val ids = mutableListOf(clsId)
        ids.addAll(truncated.map { vocab[it] ?: unkId })
        ids.add(sepId)
        val mask = MutableList(ids.size) { 1L }
        val typeIds = MutableList(ids.size) { 0L }
        // Pad to maxLength
        while (ids.size < maxLength) {
            ids.add(padId)
            mask.add(0L)
            typeIds.add(0L)
        }
        return TokenizedInput(
            inputIds = ids.map { it.toLong() }.toLongArray(),
            attentionMask = mask.toLongArray(),
            tokenTypeIds = typeIds.toLongArray()
        )
    }

    private fun tokenize(text: String): List<String> {
        val words = text.lowercase().split(Regex("\\s+")).filter { it.isNotEmpty() }
        val tokens = mutableListOf<String>()
        for (word in words) {
            tokens.addAll(wordPieceTokenize(word))
        }
        return tokens
    }

    private fun wordPieceTokenize(word: String): List<String> {
        val pieces = mutableListOf<String>()
        var start = 0
        while (start < word.length) {
            var end = word.length
            var found: String? = null
            while (start < end) {
                val sub = if (start == 0) word.substring(start, end)
                else "##${word.substring(start, end)}"
                if (sub in vocab) { found = sub; break }
                end--
            }
            if (found == null) { pieces.add("[UNK]"); break }
            pieces.add(found)
            start = end
        }
        return pieces
    }

    private fun loadVocab(path: Path): Map<String, Int> {
        return path.readLines()
            .mapIndexed { idx, line -> line.trim() to idx }
            .toMap()
    }
}

/** Tokenized input ready for ONNX model. */
data class TokenizedInput(
    val inputIds: LongArray,
    val attentionMask: LongArray,
    val tokenTypeIds: LongArray
)
