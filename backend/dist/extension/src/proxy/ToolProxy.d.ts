/**
 * ToolProxy — registers MCP tools with IDE, forwards calls to Backend.
 * KSA-292: Added local/remote tool routing (TDD §4.3).
 * Local tools (embed_images) execute via FileProxyHandler.
 * Remote tools forward via HttpClient with auth.
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
    private executeLocalTool;
    private errorResult;
    private log;
}
