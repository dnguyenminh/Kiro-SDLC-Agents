"use strict";
/**
 * Embedding Engine — Generate, store, and search embeddings via Ollama.
 * Optional component: gracefully skips if Ollama unavailable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingEngine = void 0;
class EmbeddingEngine {
    db;
    client;
    enabled = false;
    constructor(dbManager, client) {
        this.db = dbManager.getDb();
        this.client = client;
    }
    /** Initialize and check if embeddings are available. */
    async initialize() {
        this.enabled = await this.client.isAvailable();
        if (this.enabled) {
            console.error('[embeddings] Ollama available, semantic search enabled');
        }
        else {
            console.error('[embeddings] Ollama unavailable, semantic search disabled');
        }
    }
    /** Generate and store embedding for a symbol. */
    async embedSymbol(symbolId, text, model) {
        if (!this.enabled)
            return;
        const vector = await this.client.generateEmbedding(text);
        if (!vector)
            return;
        this.storeEmbedding(symbolId, null, vector, model);
    }
    /** Semantic search using cosine similarity. */
    searchSimilar(queryVector, limit = 10) {
        if (!this.enabled)
            return [];
        const rows = this.db.prepare('SELECT id, symbol_id, file_id, vector FROM embeddings').all();
        const scored = rows
            .map(row => ({
            symbolId: row.symbol_id,
            fileId: row.file_id,
            score: cosineSimilarity(queryVector, deserializeVector(row.vector)),
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        return scored;
    }
    /** Check if embedding engine is active. */
    isEnabled() {
        return this.enabled;
    }
    storeEmbedding(symbolId, fileId, vector, model) {
        const blob = serializeVector(vector);
        this.db.prepare(`
      INSERT INTO embeddings (symbol_id, file_id, vector, model)
      VALUES (?, ?, ?, ?)
    `).run(symbolId, fileId, blob, model);
    }
}
exports.EmbeddingEngine = EmbeddingEngine;
function serializeVector(vector) {
    const buf = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) {
        buf.writeFloatLE(vector[i], i * 4);
    }
    return buf;
}
function deserializeVector(buf) {
    const vector = [];
    for (let i = 0; i < buf.length; i += 4) {
        vector.push(buf.readFloatLE(i));
    }
    return vector;
}
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
//# sourceMappingURL=embedding-engine.js.map