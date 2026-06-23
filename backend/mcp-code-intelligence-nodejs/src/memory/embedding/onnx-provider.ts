/**
 * ONNX Runtime embedding provider for all-MiniLM-L6-v2.
 * Lazy loads model on first embed call. Uses mean pooling + L2 normalize.
 */

import * as fs from 'fs';
import { EmbeddingProvider } from './provider.js';
import { Tokenizer, TokenizedInput } from './tokenizer.js';
import { ensureOnnxRuntime } from './onnx-bootstrap.js';

const MAX_SEQ_LENGTH = 128;

export class OnnxEmbeddingProvider implements EmbeddingProvider {
  private readonly modelPath: string;
  private readonly vocabPath: string;
  private session: any | null = null;
  private tokenizer: Tokenizer | null = null;

  constructor(modelPath: string, vocabPath: string) {
    this.modelPath = modelPath;
    this.vocabPath = vocabPath;
  }

  get modelName(): string {
    return 'all-MiniLM-L6-v2';
  }

  get dimensions(): number {
    return 384;
  }

  async embed(text: string): Promise<number[] | null> {
    try {
      await this.ensureLoaded();
      return await this.runInference(text);
    } catch (e: any) {
      log(`ONNX embed error: ${e.message}`);
      return null;
    }
  }

  async embedBatch(texts: string[]): Promise<Array<number[] | null>> {
    const results: Array<number[] | null> = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  isAvailable(): boolean {
    return fs.existsSync(this.modelPath) && fs.existsSync(this.vocabPath);
  }

  close(): void {
    this.session = null;
    this.tokenizer = null;
  }

  /** Lazy-load ONNX model on first use. */
  private async ensureLoaded(): Promise<void> {
    if (this.session !== null) return;
    let ort: any;
    try {
      // Try loading from ONNX_RUNTIME_PATH (prebuilt binary from extension or bootstrap)
      let onnxPath = process.env.ONNX_RUNTIME_PATH;

      // If not set, try self-download via bootstrap
      if (!onnxPath) {
        const bootstrapPath = await ensureOnnxRuntime();
        if (bootstrapPath) {
          onnxPath = bootstrapPath;
        }
      }

      if (onnxPath) {
        ort = require(onnxPath);
      } else {
        // @ts-ignore — onnxruntime-node is an optional dependency
        ort = await import('onnxruntime-node');
      }
    } catch {
      throw new Error(
        'onnxruntime-node not installed. Install with: npm install onnxruntime-node'
      );
    }
    this.session = await ort.InferenceSession.create(this.modelPath);
    this.tokenizer = new Tokenizer(this.vocabPath);
    log(`ONNX model loaded: ${this.modelPath}`);
  }

  /** Tokenize, run ONNX, mean-pool, normalize. */
  private async runInference(text: string): Promise<number[]> {
    // Use ONNX_RUNTIME_PATH (already resolved by ensureLoaded)
    const onnxPath = process.env.ONNX_RUNTIME_PATH;
    // @ts-ignore — onnxruntime-node is an optional dependency
    const ort = onnxPath
      ? require(onnxPath)
      : await import('onnxruntime-node');
    const encoded = this.tokenizer!.encode(text, MAX_SEQ_LENGTH);
    const feeds = {
      input_ids: new ort.Tensor('int64', encoded.inputIds, [1, MAX_SEQ_LENGTH]),
      attention_mask: new ort.Tensor('int64', encoded.attentionMask, [1, MAX_SEQ_LENGTH]),
      token_type_ids: new ort.Tensor('int64', encoded.tokenTypeIds, [1, MAX_SEQ_LENGTH]),
    };
    const results = await this.session!.run(feeds);
    const outputKey = Object.keys(results)[0];
    const outputData = results[outputKey].data as Float32Array;
    // Shape: [1, seq_len, 384] — extract token embeddings
    const tokenEmbeddings = this.reshapeOutput(outputData, MAX_SEQ_LENGTH, 384);
    const pooled = this.meanPool(tokenEmbeddings, encoded.attentionMask);
    return this.normalize(pooled);
  }

  /** Reshape flat output to [seq_len][dims]. */
  private reshapeOutput(data: Float32Array, seqLen: number, dims: number): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < seqLen; i++) {
      const row: number[] = [];
      for (let j = 0; j < dims; j++) {
        row.push(data[i * dims + j]);
      }
      result.push(row);
    }
    return result;
  }

  /** Mean pooling over non-padding tokens. */
  private meanPool(embeddings: number[][], mask: BigInt64Array): number[] {
    const dims = embeddings[0].length;
    const summed = new Array<number>(dims).fill(0);
    let count = 0;
    for (let i = 0; i < embeddings.length; i++) {
      if (mask[i] === 1n) {
        for (let j = 0; j < dims; j++) {
          summed[j] += embeddings[i][j];
        }
        count++;
      }
    }
    const divisor = Math.max(count, 1);
    return summed.map(v => v / divisor);
  }

  /** L2 normalize vector. */
  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map(v => v / norm);
  }
}

function log(msg: string): void {
  process.stderr.write(`[onnx-embed] ${msg}\n`);
}
