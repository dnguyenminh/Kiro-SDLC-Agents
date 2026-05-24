"use strict";
/**
 * ToolEmbeddingIndex — pre-computed embedding vectors for all registered tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolEmbeddingIndex = void 0;
class ToolEmbeddingIndex {
    toolNames = [];
    vectors = [];
    built = false;
    get isBuilt() { return this.built && this.vectors.length > 0; }
    get toolCount() { return this.toolNames.length; }
    /** Build index by embedding all tool descriptions. */
    build(registry, embedFn) {
        const start = performance.now();
        const tools = registry.allChildTools();
        if (tools.length === 0) {
            console.error('[tool-index] No tools to index');
            return;
        }
        const names = [];
        const vecs = [];
        for (const tool of tools) {
            const desc = tool.definition?.description ?? '';
            const text = `${tool.name} ${desc}`;
            const vec = embedFn(text);
            if (vec) {
                names.push(tool.name);
                vecs.push(vec);
            }
        }
        if (vecs.length === 0) {
            console.error('[tool-index] No embeddings generated');
            return;
        }
        this.toolNames = names;
        this.vectors = vecs;
        this.built = true;
        const elapsed = performance.now() - start;
        console.error(`[tool-index] Index built: ${names.length} tools in ${elapsed.toFixed(0)}ms`);
    }
    /** Find top-k tools by cosine similarity to query vector. */
    search(queryVector, topK = 5) {
        if (!this.isBuilt)
            return [];
        const qNorm = vecNorm(queryVector);
        if (qNorm === 0)
            return [];
        const q = queryVector.map((v) => v / qNorm);
        const scores = [];
        for (let i = 0; i < this.vectors.length; i++) {
            const vNorm = vecNorm(this.vectors[i]);
            if (vNorm === 0)
                continue;
            const sim = dotProduct(q, this.vectors[i]) / vNorm;
            if (sim > 0)
                scores.push([this.toolNames[i], sim]);
        }
        scores.sort((a, b) => b[1] - a[1]);
        return scores.slice(0, topK);
    }
    /** Clear the index. */
    clear() {
        this.toolNames = [];
        this.vectors = [];
        this.built = false;
    }
}
exports.ToolEmbeddingIndex = ToolEmbeddingIndex;
function dotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++)
        sum += a[i] * b[i];
    return sum;
}
function vecNorm(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++)
        sum += v[i] * v[i];
    return Math.sqrt(sum);
}
//# sourceMappingURL=tool-index.js.map