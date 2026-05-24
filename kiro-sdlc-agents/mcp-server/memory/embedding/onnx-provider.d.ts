/**
 * ONNX Runtime embedding provider for all-MiniLM-L6-v2.
 * Lazy loads model on first embed call. Uses mean pooling + L2 normalize.
 */
import { EmbeddingProvider } from './provider.js';
export declare class OnnxEmbeddingProvider implements EmbeddingProvider {
    private readonly modelPath;
    private readonly vocabPath;
    private session;
    private tokenizer;
    constructor(modelPath: string, vocabPath: string);
    get modelName(): string;
    get dimensions(): number;
    embed(text: string): Promise<number[] | null>;
    embedBatch(texts: string[]): Promise<Array<number[] | null>>;
    isAvailable(): boolean;
    close(): void;
    /** Lazy-load ONNX model on first use. */
    private ensureLoaded;
    /** Tokenize, run ONNX, mean-pool, normalize. */
    private runInference;
    /** Reshape flat output to [seq_len][dims]. */
    private reshapeOutput;
    /** Mean pooling over non-padding tokens. */
    private meanPool;
    /** L2 normalize vector. */
    private normalize;
}
//# sourceMappingURL=onnx-provider.d.ts.map