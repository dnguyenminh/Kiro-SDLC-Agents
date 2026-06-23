"use strict";
/**
 * EmbeddingService — coordinates embedding generation and storage.
 * Wraps provider + vector repo for embed-and-store workflow.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
exports.floatListToBytes = floatListToBytes;
exports.bytesToFloatList = bytesToFloatList;
class EmbeddingService {
    provider;
    vectorRepo;
    constructor(provider, vectorRepo) {
        this.provider = provider;
        this.vectorRepo = vectorRepo;
    }
    /** Generate and store embedding for a knowledge entry. */
    async embedAndStore(entryId, text) {
        const vector = await this.provider.embed(text);
        if (!vector)
            return false;
        const blob = floatListToBytes(vector);
        this.vectorRepo.upsert(entryId, blob, this.provider.modelName, this.provider.dimensions);
        return true;
    }
    /** Embed multiple entries. Returns count of successes. */
    async embedBatchAndStore(entries) {
        let count = 0;
        for (const [entryId, text] of entries) {
            if (await this.embedAndStore(entryId, text))
                count++;
        }
        return count;
    }
    /** Get raw embedding for text (without storing). */
    async embed(text) {
        return this.provider.embed(text);
    }
    /** Check if embedding provider is available. */
    isAvailable() {
        return this.provider.isAvailable();
    }
    /** Release resources. */
    close() {
        this.provider.close();
    }
    /** Cosine similarity between two vectors. */
    static cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0.0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 0 ? dot / denom : 0.0;
    }
}
exports.EmbeddingService = EmbeddingService;
/** Convert float array to little-endian Buffer (Float32). */
function floatListToBytes(arr) {
    const buf = Buffer.alloc(arr.length * 4);
    for (let i = 0; i < arr.length; i++) {
        buf.writeFloatLE(arr[i], i * 4);
    }
    return buf;
}
/** Convert little-endian Buffer back to float array. */
function bytesToFloatList(data) {
    const count = data.length / 4;
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(data.readFloatLE(i * 4));
    }
    return result;
}
//# sourceMappingURL=service.js.map