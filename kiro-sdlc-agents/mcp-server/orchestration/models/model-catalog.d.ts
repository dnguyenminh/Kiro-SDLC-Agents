/**
 * Model catalog — known embedding models with metadata.
 */
export interface ModelInfo {
    displayName: string;
    sizeMb: number;
    languages: string[];
    vocabSize: number;
    dimensions: number;
    baseUrl: string;
    files: Record<string, string>;
}
export declare const MODELS: Record<string, ModelInfo>;
export declare const DEFAULT_MODEL = "all-MiniLM-L6-v2";
/** Get model metadata by name. */
export declare function getModelInfo(name: string): ModelInfo | null;
/** List all known models with metadata. */
export declare function listModels(): Array<{
    name: string;
} & ModelInfo>;
//# sourceMappingURL=model-catalog.d.ts.map