/**
 * CurrentFileProvider — Active editor file resolution
 * KSA-252
 */
interface ExtensionContext {
    getActiveEditorPath(): string | null;
}
export declare class CurrentFileProvider {
    private context;
    constructor(context: ExtensionContext);
    getFileName(): string | null;
}
export {};
//# sourceMappingURL=CurrentFileProvider.d.ts.map