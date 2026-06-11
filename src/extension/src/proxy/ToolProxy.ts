/**
 * ToolProxy — registers MCP tools with IDE, forwards calls to Backend.
 * Implements TDD §5.3 IToolProxy, §5.4 Proxy pattern.
 * Handles BR-6 (52 tools), BR-7 (identical schemas), BR-8 (<50ms overhead), BR-9 (error forwarding).
 */

import * as vscode from 'vscode';
import { ToolDefinition, ToolResult } from '../types/proxy';
import { HttpError } from './HttpClient';
import { ToolRegistry } from './ToolRegistry';
import { ConnectionManager } from '../connection/ConnectionManager';
import { FileProxyHandler, FileProxyError, ToolResultWithFile } from './FileProxyHandler';

export interface IToolProxy {
  registerTools(tools: ToolDefinition[]): Promise<void>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  getRegisteredTools(): ToolDefinition[];
}

export class ToolProxy implements IToolProxy, vscode.Disposable {
  private readonly registry: ToolRegistry;
  private readonly connectionManager: ConnectionManager;
  private readonly fileProxy: FileProxyHandler;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly outputChannel: vscode.OutputChannel;

  constructor(
    connectionManager: ConnectionManager,
    outputChannel: vscode.OutputChannel
  ) {
    this.connectionManager = connectionManager;
    this.outputChannel = outputChannel;
    this.registry = new ToolRegistry();
    this.fileProxy = new FileProxyHandler(outputChannel);
  }

  async registerTools(tools: ToolDefinition[]): Promise<void> {
    this.registry.update(tools);

    for (const tool of tools) {
      try {
        const disposable = vscode.lm.registerTool(tool.name, {
          invoke: async (_options: vscode.LanguageModelToolInvocationOptions<unknown>, _token: vscode.CancellationToken) => {
            const args = _options.input as Record<string, unknown> ?? {};
            const result = await this.callTool(tool.name, args);
            return new vscode.LanguageModelToolResult(
              result.content.map((block) => {
                if (block.type === 'text') {
                  return new vscode.LanguageModelTextPart(block.text ?? '');
                }
                return new vscode.LanguageModelTextPart(JSON.stringify(block));
              })
            );
          },
          prepareInvocation: async (_options: vscode.LanguageModelToolInvocationPrepareOptions<unknown>, _token: vscode.CancellationToken) => {
            return {
              invocationMessage: 'Calling ' + tool.name + '...',
            };
          },
        });
        this.disposables.push(disposable);
      } catch (error) {
        this.log('Failed to register tool ' + tool.name + ': ' + (error as Error).message);
      }
    }

    this.log('Registered ' + tools.length + ' tools');
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.connectionManager.isConnected()) {
      return this.errorResult('BACKEND_UNAVAILABLE', 'Backend is not connected');
    }

    if (!this.registry.has(name)) {
      return this.errorResult('TOOL_NOT_FOUND', "Tool '" + name + "' not found");
    }

    try {
      // File Proxy: enrich args with file content if needed (Pattern 1 and Both)
      const enrichedArgs = await this.fileProxy.enrichWithFileContent(name, args);

      const client = this.connectionManager.getHttpClient();
      const result = await client.callTool({ tool_name: name, arguments: enrichedArgs }) as ToolResultWithFile;

      // File Proxy: write output file if Backend returned __file_output (Pattern 2 and Both)
      await this.fileProxy.handleFileOutput(result);

      // Remove __file_output from result before returning to caller (transparent)
      if (result.__file_output) {
        delete (result as Record<string, unknown>).__file_output;
      }

      return result;
    } catch (error) {
      if (error instanceof FileProxyError) {
        return this.errorResult(error.code, error.message);
      }
      if (error instanceof HttpError) {
        return this.errorResult('INTERNAL_ERROR', 'Tool execution failed: ' + error.body);
      }
      if ((error as Error).name === 'AbortError') {
        return this.errorResult('TIMEOUT', 'Tool call timed out');
      }
      return this.errorResult('BACKEND_UNAVAILABLE', 'Backend is not responding: ' + (error as Error).message);
    }
  }

  getRegisteredTools(): ToolDefinition[] {
    return this.registry.getDefinitions();
  }

  async refreshTools(): Promise<void> {
    if (!this.connectionManager.isConnected()) return;

    try {
      const client = this.connectionManager.getHttpClient();
      const response = await client.listTools();
      await this.registerTools(response.tools);
    } catch (error) {
      this.log('Failed to refresh tools: ' + (error as Error).message);
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.registry.clear();
  }

  private errorResult(code: string, message: string): ToolResult {
    return {
      content: [{ type: 'text', text: 'Error [' + code + ']: ' + message }],
      isError: true,
    };
  }

  private log(message: string): void {
    this.outputChannel.appendLine('[ToolProxy] ' + message);
  }
}
