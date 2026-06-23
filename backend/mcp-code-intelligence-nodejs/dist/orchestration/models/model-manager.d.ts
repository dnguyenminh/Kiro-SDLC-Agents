/**
 * ModelManager — MCP tool for model lifecycle (list, download, status, switch).
 */
export declare class ModelManager {
    private registry;
    private downloading;
    constructor(modelsDir?: string);
    /** Handle action: list, download, status, switch. */
    execute(args: Record<string, any>): string;
    getActiveModel(): string;
    getActiveModelPath(): string;
    /** Background download of default model on first need. */
    autoDownloadIfNeeded(): void;
    private handleList;
    private handleDownload;
    private handleStatus;
    private handleSwitch;
    private doDownload;
    private backgroundDownload;
    private downloadFiles;
    private downloadFile;
}
//# sourceMappingURL=model-manager.d.ts.map