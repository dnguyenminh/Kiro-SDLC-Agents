/**
 * EmbeddingFactory — creates EmbeddingService with priority: Ollama → ONNX → null.
 * Matches Python/Kotlin behavior for provider selection.
 */
import { EmbeddingService } from './service.js';
import { VectorRepository } from '../vector-repo.js';
/** Config shape expected by factory. */
interface EmbeddingConfig {
    workspace: string;
    ollamaUrl?: string | null;
    ollamaModel?: string;
}
export declare class EmbeddingFactory {
    /** Try providers in priority order, return first available. */
    static create(config: EmbeddingConfig, vectorRepo: VectorRepository): EmbeddingService | null;
    /** Attempt Ollama provider if URL is configured. */
    private static tryOllama;
    /** Attempt local ONNX provider if model files exist. */
    private static tryOnnx;
    /** Find model.onnx in workspace or home .code-intel/models/. */
    private static resolveModel;
    /** Find vocab.txt in workspace or home .code-intel/models/. */
    private static resolveVocab;
}
export {};
//# sourceMappingURL=factory.d.ts.map