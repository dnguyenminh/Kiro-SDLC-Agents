/**
 * EmbeddingSearcher — adapter connecting find_tools to ONNX embedding search.
 */
import { ModelManager } from '../models/model-manager.js';
import { UnifiedRegistry } from '../registry/index.js';
export declare class EmbeddingSearcher {
    private modelManager;
    private registry;
    private provider;
    private index;
    private initialized;
    constructor(modelManager: ModelManager, registry: UnifiedRegistry);
    /** True if ONNX model is loaded and ready. */
    get isAvailable(): boolean;
    /** Search tools by embedding similarity. Returns [toolName, score] or null. */
    search(query: string, timeoutMs?: number): [string, number] | null;
    /** Rebuild tool embedding index (after model switch or new tools). */
    rebuildIndex(): void;
    private tryInit;
    private createProvider;
}
//# sourceMappingURL=embedding-searcher.d.ts.map