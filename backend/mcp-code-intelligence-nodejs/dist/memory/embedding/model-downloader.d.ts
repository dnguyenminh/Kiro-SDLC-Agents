/**
 * ModelDownloader — auto-download HuggingFace ONNX models.
 */
export declare class ModelDownloader {
    private modelsDir;
    constructor(modelsDir: string);
    get modelPath(): string;
    get vocabPath(): string;
    /** Check if model files exist locally. */
    isModelPresent(): boolean;
    /** Download model files from HuggingFace. Returns true on success. */
    downloadIfMissing(): Promise<boolean>;
    private downloadFile;
}
//# sourceMappingURL=model-downloader.d.ts.map