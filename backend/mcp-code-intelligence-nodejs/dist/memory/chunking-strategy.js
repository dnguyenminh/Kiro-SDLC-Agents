"use strict";
/**
 * Zero-context chunking strategies for document ingestion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticChunker = exports.FixedSizeChunker = void 0;
/** Fixed-size chunking with overlap. */
class FixedSizeChunker {
    chunkSize;
    overlap;
    constructor(chunkSize = 512, overlap = 64) {
        this.chunkSize = chunkSize;
        this.overlap = overlap;
    }
    chunk(text, metadata = {}) {
        if (text.length <= this.chunkSize) {
            return [{ content: text, index: 0, startOffset: 0, endOffset: text.length, metadata }];
        }
        return this.splitFixed(text, metadata);
    }
    splitFixed(text, metadata) {
        const chunks = [];
        let start = 0;
        let index = 0;
        while (start < text.length) {
            const end = Math.min(start + this.chunkSize, text.length);
            chunks.push({ content: text.slice(start, end), index, startOffset: start, endOffset: end, metadata });
            start += this.chunkSize - this.overlap;
            index++;
        }
        return chunks;
    }
}
exports.FixedSizeChunker = FixedSizeChunker;
/** Semantic chunking — splits on paragraph/section boundaries. */
class SemanticChunker {
    maxChunkSize;
    minChunkSize;
    constructor(maxChunkSize = 1024, minChunkSize = 100) {
        this.maxChunkSize = maxChunkSize;
        this.minChunkSize = minChunkSize;
    }
    chunk(text, metadata = {}) {
        const paragraphs = splitParagraphs(text);
        return mergeParagraphs(paragraphs, this.maxChunkSize, metadata);
    }
}
exports.SemanticChunker = SemanticChunker;
function splitParagraphs(text) {
    return text.split(/\n{2,}/).filter(p => p.trim());
}
function mergeParagraphs(paragraphs, maxSize, metadata) {
    const chunks = [];
    let current = '';
    let offset = 0;
    let index = 0;
    for (const para of paragraphs) {
        if (current.length + para.length > maxSize && current) {
            chunks.push({ content: current.trim(), index, startOffset: offset, endOffset: offset + current.length, metadata });
            offset += current.length;
            current = '';
            index++;
        }
        current += para + '\n';
    }
    if (current.trim()) {
        chunks.push({ content: current.trim(), index, startOffset: offset, endOffset: offset + current.length, metadata });
    }
    return chunks;
}
//# sourceMappingURL=chunking-strategy.js.map