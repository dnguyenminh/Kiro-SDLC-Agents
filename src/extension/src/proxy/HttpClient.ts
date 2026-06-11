/**
 * HttpClient — lightweight HTTP client for Extension to Backend communication.
 * Implements TDD §6.1 Communication Protocol.
 */

import { ToolCallRequest, ToolResult, ToolListResponse } from '../types/proxy';
import { HealthResponse } from '../types/connection';

export interface HttpClientConfig {
  baseUrl: string;
  healthTimeout: number;
  toolCallTimeout: number;
  webviewTimeout: number;
}

export class HttpClient {
  private readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
  }

  async health(): Promise<HealthResponse> {
    const response = await this.doFetch('/health', {
      method: 'GET',
      timeout: this.config.healthTimeout,
    });
    return response.json() as Promise<HealthResponse>;
  }

  async listTools(): Promise<ToolListResponse> {
    const response = await this.doFetch('/mcp/tools/list', {
      method: 'GET',
      timeout: this.config.toolCallTimeout,
    });
    return response.json() as Promise<ToolListResponse>;
  }

  async callTool(request: ToolCallRequest): Promise<ToolResult> {
    const response = await this.doFetch('/mcp/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      timeout: this.config.toolCallTimeout,
    });
    return response.json() as Promise<ToolResult>;
  }

  async fetchWebviewData<T>(path: string): Promise<T> {
    const response = await this.doFetch(path, {
      method: 'GET',
      timeout: this.config.webviewTimeout,
    });
    const json = await response.json() as { data: T };
    return json.data;
  }

  async postWebviewData<T>(path: string, body: unknown): Promise<T> {
    const response = await this.doFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: this.config.webviewTimeout,
    });
    const json = await response.json() as { data: T };
    return json.data;
  }

  private async doFetch(path: string, options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
    timeout: number;
  }): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const url = this.config.baseUrl + path;
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        const errorBody = await response.text();
        throw new HttpError(response.status, errorBody);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: string
  ) {
    super('HTTP ' + statusCode + ': ' + body);
    this.name = 'HttpError';
  }
}
