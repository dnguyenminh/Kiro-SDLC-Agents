/**
 * KSA-169: Chunker — Split text into overlapping chunks for embedding.
 * Uses token-based splitting with configurable overlap.
 */
export class Chunker {
    maxTokens;
    overlap;
    constructor(maxTokens = 512, overlap = 128) {
        this.maxTokens = maxTokens;
        this.overlap = overlap;
    }
    /** Split text into chunks. Returns single chunk if <= maxTokens. */
    chunk(text) {
        const words = text.split(/\s+/).filter(Boolean);
        const totalTokens = words.length;
        if (totalTokens <= this.maxTokens) {
            return [{
                    text,
                    index: 0,
                    tokenCount: totalTokens,
                    startOffset: 0,
                    endOffset: text.length,
                }];
        }
        const chunks = [];
        let start = 0;
        let chunkIndex = 0;
        while (start < words.length) {
            const end = Math.min(start + this.maxTokens, words.length);
            const chunkWords = words.slice(start, end);
            const chunkText = chunkWords.join(' ');
            chunks.push({
                text: chunkText,
                index: chunkIndex,
                tokenCount: chunkWords.length,
                startOffset: start,
                endOffset: end,
            });
            chunkIndex++;
            start += this.maxTokens - this.overlap;
            if (start >= words.length)
                break;
        }
        return chunks;
    }
    getMaxTokens() {
        return this.maxTokens;
    }
    getOverlap() {
        return this.overlap;
    }
}
//# sourceMappingURL=chunker.js.map