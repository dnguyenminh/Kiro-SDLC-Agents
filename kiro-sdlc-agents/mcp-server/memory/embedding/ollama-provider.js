"use strict";
/**
 * Ollama-backed embedding provider — wraps HTTP calls to Ollama API.
 * Uses /api/embeddings endpoint for text-to-vector conversion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaEmbeddingProvider = void 0;
class OllamaEmbeddingProvider {
    client;
    model;
    constructor(client, model) {
        this.client = client;
        this.model = model;
    }
    get modelName() {
        return this.model;
    }
    get dimensions() {
        // nomic-embed-text default dimension
        return 768;
    }
    async embed(text) {
        return this.client.getEmbedding(text);
    }
    async embedBatch(texts) {
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text));
        }
        return results;
    }
    isAvailable() {
        return this.client.isAvailable();
    }
    close() {
        // No resources to release for HTTP client
    }
}
exports.OllamaEmbeddingProvider = OllamaEmbeddingProvider;
function log(msg) {
    process.stderr.write(`[ollama-embed] ${msg}\n`);
}
//# sourceMappingURL=ollama-provider.js.map