"use strict";
/**
 * Ollama HTTP Client — Communicates with local Ollama API for embeddings.
 * Gracefully degrades if Ollama is not available.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaClient = void 0;
class OllamaClient {
    url;
    model;
    available = null;
    constructor(config) {
        this.url = config.url;
        this.model = config.model;
    }
    /** Check if Ollama is reachable. */
    async isAvailable() {
        if (this.available !== null)
            return this.available;
        try {
            const resp = await fetch(`${this.url}/api/tags`, { signal: AbortSignal.timeout(3000) });
            this.available = resp.ok;
        }
        catch {
            this.available = false;
        }
        console.error(`[ollama] Available: ${this.available}`);
        return this.available;
    }
    /** Generate embedding vector for text. */
    async generateEmbedding(text) {
        if (!await this.isAvailable())
            return null;
        try {
            const resp = await fetch(`${this.url}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: this.model, prompt: text }),
                signal: AbortSignal.timeout(30000),
            });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            return data.embedding;
        }
        catch (err) {
            console.error('[ollama] Embedding error:', err);
            return null;
        }
    }
    /** Generate embeddings for multiple texts in batch. */
    async generateBatch(texts) {
        const results = [];
        for (const text of texts) {
            results.push(await this.generateEmbedding(text));
        }
        return results;
    }
}
exports.OllamaClient = OllamaClient;
//# sourceMappingURL=ollama-client.js.map