/**
 * ToolProxy — registers MCP tools and forwards calls to Backend.
 * Transparent proxy: tool names, schemas, and responses are unchanged.
 * Implements: UC-2, BR-6..BR-11
 */

import * as vscode from 'vscode';
import type { HttpClient } from './HttpClient';
import type { ToolDefinition, ToolResult } from '../types/proxy';

export class ToolProxy implements vscode.Disposable {
  private httpClient: HttpClient;
  private registeredTools: Map<string, ToolDefinition> = new Map();
  private disposables: vscode.Disposable[] = [];
  private outputChannel: vscode.OutputChannel;

  constructor(httpClient: HttpClient, outputChannel: vscode.OutputChannel) {
    this.httpClient = httpClient;
    this.outputChannel = outputChannel;
  }

  /**
   * Fetch tool list from Backend and register all tools with VS Code.
   */
  async registerTools(): Promise<void> {
    try {
      const response = await this.httpClient.listTools();
      const tools = response.tools;

      this.outputChannel.appendLine(`[ToolProxy] Fetched ${tools.length} tools from Backend`);

      for (const tool of tools) {
        this.registeredTools.set(tool.name, tool);
      }

      // In a real VS Code extension, we would use vscode.lm.registerTool()
      // For now, store the definitions for proxy routing
      this.outputChannel.appendLine(`[ToolProxy] Registered ${this.registeredTools.size} tools`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[ToolProxy] Failed to register tools: ${message}`);
    }
  }

  /**
   * Forward a tool call to the Backend and return the result.
   * Per BR-9: tool errors are forwarded as-is.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.registeredTools.has(name)) {
      return {
        content: [{ type: 'text', text: `Tool '${name}' not found in registry` }],
        isError: true,
      };
    }

    const start = Date.now();

    try {
      const result = await this.httpClient.callTool(name, args);
      const duration = Date.now() - start;
      this.outputChannel.appendLine(`[ToolProxy] ${name} completed in ${duration}ms`);
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[ToolProxy] ${name} failed after ${duration}ms: ${message}`);

      // Map internal errors to user-facing codes
      const userMessage = this.mapErrorMessage(err);
      return {
        content: [{ type: 'text', text: userMessage }],
        isError: true,
      };
    }
  }

  getRegisteredTools(): ToolDefinition[] {
    return Array.from(this.registeredTools.values());
  }

  getToolCount(): number {
    return this.registeredTools.size;
  }

  private mapErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
        return 'Backend is not connected';
      }
      if (err.message.includes('timeout') || err.message.includes('TimeoutError')) {
        return 'Tool call timed out';
      }
      if (err.message.includes('not found')) {
        return err.message;
      }
      return `Tool execution failed: ${err.message}`;
    }
    return 'Tool execution failed: Unknown error';
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.registeredTools.clear();
  }
}
