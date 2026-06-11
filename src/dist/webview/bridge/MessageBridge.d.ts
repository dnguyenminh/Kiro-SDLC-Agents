/**
 * MessageBridge — postMessage request/response bridge between webview and extension host
 * KSA-252
 */
import type { ContextRequest, FileTreeNode, FolderTreeNode, McpResourceItem, DiagnosticItem } from '../../shared/protocol';
import type { VsCodeApi } from './types';
export declare class MessageBridge {
    private pendingRequests;
    private requestId;
    private defaultTimeout;
    private vscodeApi;
    constructor(vscodeApi: VsCodeApi, defaultTimeout?: number);
    private handleMessage;
    request<T>(message: ContextRequest, timeout?: number): Promise<T>;
    getFileTree(): Promise<FileTreeNode[]>;
    getSpecList(): Promise<string[]>;
    getFolderTree(): Promise<FolderTreeNode[]>;
    getSteeringFiles(): Promise<string[]>;
    getMcpResources(): Promise<McpResourceItem[]>;
    getActiveFileName(): Promise<string | null>;
    resolveGitDiff(): Promise<string>;
    resolveTerminalOutput(lines?: number): Promise<string>;
    resolveDiagnostics(): Promise<DiagnosticItem[]>;
    dispose(): void;
}
//# sourceMappingURL=MessageBridge.d.ts.map