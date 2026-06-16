/**
 * HttpClient — lightweight HTTP client for Extension to Remote Backend.
 * KSA-292: Added auth header injection, configurable URL, 401 handling.
 * Implements TDD §4.2 HttpClient, §6.2 Auth Header Injection.
 */

import { ToolCallRequest, ToolResult, ToolListResponse } from '../types/proxy';
import { HealthResponse } from '../types/connection';
import { AuthManager } from '../auth/AuthManager';

export interface HttpClientConfig {
  baseUrl: string;
  authManager: AuthManager;
  healthTimeout?: number;
  toolCallTimeout?: number;
  webviewTimeout?: number;
  chatTimeout?: number;
  uploadTimeout?: number;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly authManager: AuthManager;
  private readonly healthTimeout: number;
  private readonly toolCallTimeout: number;
  private readonly webviewTimeout: number;
  private readonly chatTimeout: number;
  private readonly uploadTimeout: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.authManager = config.authManager;
    this.healthTimeout = config.healthTimeout ?? 3000;
    this.toolCallTimeout = config.toolCallTimeout ?? 300000;
    this.webviewTimeout = config.webviewTimeout ?? 10000;
    this.chatTimeout = config.chatTimeout ?? 120000;
    this.uploadTimeout = config.uploadTimeout ?? 600000;
  }

  get url(): string {
    return this.baseUrl;
  }

  async health(): Promise<HealthResponse> {
    const response = await this.doFetch('/health', {
      method: 'GET',
      timeout: this.healthTimeout,
      skipAuth: true, // health check doesn't need auth
    });
    return response.json() as Promise<HealthResponse>;
  }

  async listTools(): Promise<ToolListResponse> {
    const response = await this.doFetch('/mcp/tools/list', {
      method: 'GET',
      timeout: this.toolCallTimeout,
    });
    return response.json() as Promise<ToolListResponse>;
  }

  async callTool(request: ToolCallRequest): Promise<ToolResult> {
    const response = await this.doFetch('/mcp/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      timeout: this.toolCallTimeout,
    });
    return response.json() as Promise<ToolResult>;
  }

  async fetchWebviewData<T>(path: string): Promise<T> {
    const response = await this.doFetch(path, {
      method: 'GET',
      timeout: this.webviewTimeout,
    });
    const json = await response.json() as { data: T };
    return json.data;
  }

  async postWebviewData<T>(path: string, body: unknown): Promise<T> {
    const response = await this.doFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: this.webviewTimeout,
    });
    const json = await response.json() as { data: T };
    return json.data;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.doFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: this.webviewTimeout,
    });
    return response.json() as Promise<T>;
  }

  async postMultipart(path: string, formData: FormData, _options?: { onProgress?: (pct: number) => void }): Promise<unknown> {
    const headers = await this.getAuthHeaders();
    // Remove Content-Type for FormData — browser/node sets boundary automatically
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.uploadTimeout);

    try {
      const response = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new AuthenticationRequiredError();
      }
      if (!response.ok) {
        throw new HttpError(response.status, await response.text());
      }
      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async streamChat(path: string, body: unknown): Promise<ReadableStream<Uint8Array>> {
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.chatTimeout);

    try {
      const response = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 401) {
        clearTimeout(timeoutId);
        throw new AuthenticationRequiredError();
      }
      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new HttpError(response.status, await response.text());
      }
      if (!response.body) {
        clearTimeout(timeoutId);
        throw new HttpError(500, 'No response body for streaming');
      }

      // Don't clear timeout here — stream may be long-lived
      return response.body;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.authManager.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
  }

  private async doFetch(path: string, options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
    timeout: number;
    skipAuth?: boolean;
  }): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const authHeaders = options.skipAuth ? {} : await this.getAuthHeaders();
      const headers = { ...authHeaders, ...options.headers };

      const url = this.baseUrl + path;
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new AuthenticationRequiredError();
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitedError(retryAfter ? parseInt(retryAfter, 10) : 60);
      }

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

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication required — token expired or invalid');
    this.name = 'AuthenticationRequiredError';
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Rate limited — retry after ' + retryAfterSeconds + 's');
    this.name = 'RateLimitedError';
  }
}

