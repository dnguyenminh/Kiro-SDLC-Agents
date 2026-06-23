/**
 * ToolProxy — registers MCP tools with IDE, forwards calls to Backend.
 * Implements TDD §5.3 IToolProxy, §5.4 Proxy pattern.
 * Handles BR-6 (52 tools), BR-7 (identical schemas), BR-8 (<50ms overhead), BR-9 (error forwarding).
 */
import * as vscode from 'vscode';
import { ToolDefinition, ToolResult } from '../types/proxy';
import { ConnectionManager } from '../connection/ConnectionManager';
export interface IToolProxy {
    registerTools(tools: ToolDefinition[]): Promise<void>;
    callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
    getRegisteredTools(): ToolDefinition[];
}
export declare class ToolProxy implements IToolProxy, vscode.Disposable {
    private readonly registry;
    private readonly connectionManager;
    private readonly fileProxy;
    private readonly disposables;
    private readonly outputChannel;
    constructor(connectionManager: ConnectionManager, outputChannel: vscode.OutputChannel);
    registerTools(tools: ToolDefinition[]): Promise<void>;
    callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
    getRegisteredTools(): ToolDefinition[];
    refreshTools(): Promise<void>;
    dispose(): void;
    private errorResult;
    private log;
}
//# sourceMappingURL=ToolProxy.d.ts.map