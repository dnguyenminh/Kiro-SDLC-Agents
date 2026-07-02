/**
 * ToolEmbeddingIndex — pre-computed embedding vectors for all registered tools.
 */

import { UnifiedRegistry } from '../registry/index.js';

export class ToolEmbeddingIndex {
  private toolNames: string[] = [];
  private vectors: number[][] = [];
  private built = false;

  get isBuilt(): boolean { return this.built && this.vectors.length > 0; }
  get toolCount(): number { return this.toolNames.length; }

  /** Build index by embedding all tool descriptions. */
  build(registry: UnifiedRegistry, embedFn: (text: string) => number[] | null): void {
    const start = performance.now();
    const tools = registry.allChildTools();
    if (tools.length === 0) { console.error('[tool-index] No tools to index'); return; }
    const names: string[] = [];
    const vecs: number[][] = [];

    // Batch embedding: prepare all texts first, then embed in parallel chunks
    const texts = tools.map(tool => {
      const desc = tool.definition?.description ?? '';
      return { name: tool.name, text: `${tool.name} ${desc}` };
    });

    const BATCH_SIZE = 10;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      for (const item of batch) {
        const vec = embedFn(item.text);
        if (vec) { names.push(item.name); vecs.push(vec); }
      }
    }

    if (vecs.length === 0) { console.error('[tool-index] No embeddings generated'); return; }
    this.toolNames = names;
    this.vectors = vecs;
    this.built = true;
    const elapsed = performance.now() - start;
    console.error(`[tool-index] Index built: ${names.length}/${tools.length} tools in ${elapsed.toFixed(0)}ms`);
  }

  /** Build index asynchronously with parallel embedding (for large toolsets). */
  async buildAsync(registry: UnifiedRegistry, embedFn: (text: string) => number[] | null): Promise<void> {
    const start = performance.now();
    const tools = registry.allChildTools();
    if (tools.length === 0) { console.error('[tool-index] No tools to index'); return; }

    const texts = tools.map(tool => ({
      name: tool.name,
      text: `${tool.name} ${tool.definition?.description ?? ''}`,
    }));

    const names: string[] = [];
    const vecs: number[][] = [];

    // Process in parallel batches to avoid blocking event loop
    const BATCH_SIZE = 20;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      // Yield to event loop between batches
      await new Promise(resolve => setImmediate(resolve));
      for (const item of batch) {
        const vec = embedFn(item.text);
        if (vec) { names.push(item.name); vecs.push(vec); }
      }
    }

    if (vecs.length === 0) { console.error('[tool-index] No embeddings generated'); return; }
    this.toolNames = names;
    this.vectors = vecs;
    this.built = true;
    const elapsed = performance.now() - start;
    console.error(`[tool-index] Index built (async): ${names.length}/${tools.length} tools in ${elapsed.toFixed(0)}ms`);
  }

  /** Find top-k tools by cosine similarity to query vector. */
  search(queryVector: number[], topK: number = 5): Array<[string, number]> {
    if (!this.isBuilt) return [];
    const qNorm = vecNorm(queryVector);
    if (qNorm === 0) return [];
    const q = queryVector.map((v) => v / qNorm);
    const scores: Array<[string, number]> = [];
    for (let i = 0; i < this.vectors.length; i++) {
      const vNorm = vecNorm(this.vectors[i]);
      if (vNorm === 0) continue;
      const sim = dotProduct(q, this.vectors[i]) / vNorm;
      if (sim > 0) scores.push([this.toolNames[i], sim]);
    }
    scores.sort((a, b) => b[1] - a[1]);
    return scores.slice(0, topK);
  }

  /** Clear the index. */
  clear(): void {
    this.toolNames = [];
    this.vectors = [];
    this.built = false;
  }
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function vecNorm(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}
