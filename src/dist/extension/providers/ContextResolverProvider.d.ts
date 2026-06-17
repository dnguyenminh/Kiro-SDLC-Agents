/**
 * ContextResolverProvider — Main orchestrator for resolving context data
 * KSA-252
 */
import type { ContextRequest, ContextResponse } from '../../shared/protocol';
interface VsCodeExtensionContext {
    workspaceRoot: string;
    getActiveEditorPath(): string | null;
    getTerminalOutput(lines?: number): string;
    getDiagnostics(): Array<{
        file: string;
        line: number;
        severity: string;
        message: string;
        source?: string;
    }>;
    getMcpResources(): Array<{
        server: string;
        name: string;
        type: string;
        description?: string;
    }>;
}
export declare class ContextResolverProvider {
    private fileTree;
    private gitDiff;
    private terminal;
    private diagnostics;
    private spec;
    private steering;
    private mcp;
    private currentFile;
    constructor(context: VsCodeExtensionContext);
    handleMessage(message: ContextRequest): Promise<ContextResponse>;
    dispose(): void;
}
export {};
//# sourceMappingURL=ContextResolverProvider.d.ts.map