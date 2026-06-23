/**
 * TerminalProvider — Terminal output capture
 * KSA-252
 */
interface ExtensionContext {
    getTerminalOutput(lines?: number): string;
}
export declare class TerminalProvider {
    private context;
    constructor(context: ExtensionContext);
    getOutput(lines?: number): string;
}
export {};
//# sourceMappingURL=TerminalProvider.d.ts.map