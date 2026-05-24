/**
 * ModelRegistry — tracks downloaded models and active selection via registry.json.
 */
export declare class ModelRegistry {
    private dir;
    private filePath;
    private data;
    constructor(modelsDir: string);
    get activeModel(): string;
    get modelsDir(): string;
    /** Check if a model is marked as downloaded. */
    isDownloaded(modelName: string): boolean;
    /** Get path for a specific model. */
    modelPath(modelName: string): string;
    /** Mark a model as downloaded in registry. */
    markDownloaded(modelName: string, sizeBytes: number): void;
    /** Set the active model. */
    setActive(modelName: string): void;
    /** Get all downloaded model entries. */
    getDownloadedModels(): Record<string, any>;
    private loadData;
    private save;
}
//# sourceMappingURL=model-registry.d.ts.map