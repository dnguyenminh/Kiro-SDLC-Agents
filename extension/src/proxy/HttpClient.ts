/**
 * HttpClient — HTTP communication with the Backend server.
 * Handles POST /mcp/tools/call and GET requests with proper timeout handling.
 */

import type { ToolResult } from '../types/proxy';

export interface HealthCheckResponse {
  status: string;
  version: string;
  uptime: number;
  tools_loaded: number;
  modules: Record<string, string>;
}

export interface ToolListResponse {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    category: string;
  }>;
}

export class HttpClient {
  private baseUrl: string;
  private toolCallTimeout: number;
  private healthTimeout: number;
  private webviewTimeout: number;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.toolCallTimeout = 300_000; // 5 min per TDD spec
    this.healthTimeout = 3_000;     // 3s per TDD spec
    this.webviewTimeout = 10_000;   // 10s per TDD spec
  }

  updateBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(this.healthTimeout),
    });

    if (!response.ok && response.status !== 503) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json() as Promise<HealthCheckResponse>;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const response = await fetch(`${this.baseUrl}/mcp/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_name: toolName, arguments: args }),
      signal: AbortSignal.timeout(this.toolCallTimeout),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } };
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return response.json() as Promise<ToolResult>;
  }

  async listTools(): Promise<ToolListResponse> {
    const response = await fetch(`${this.baseUrl}/mcp/tools/list`, {
      signal: AbortSignal.timeout(this.healthTimeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.status}`);
    }

    return response.json() as Promise<ToolListResponse>;
  }

  async fetchWebviewData(path: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.webviewTimeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch webview data: ${response.status}`);
    }

    return response.json();
  }
}
