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
export declare class HttpClient {
    private readonly baseUrl;
    private readonly authManager;
    private readonly healthTimeout;
    private readonly toolCallTimeout;
    private readonly webviewTimeout;
    private readonly chatTimeout;
    private readonly uploadTimeout;
    constructor(config: HttpClientConfig);
    get url(): string;
    health(): Promise<HealthResponse>;
    listTools(): Promise<ToolListResponse>;
    callTool(request: ToolCallRequest): Promise<ToolResult>;
    fetchWebviewData<T>(path: string): Promise<T>;
    postWebviewData<T>(path: string, body: unknown): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    postMultipart(path: string, formData: FormData, _options?: {
        onProgress?: (pct: number) => void;
    }): Promise<unknown>;
    streamChat(path: string, body: unknown): Promise<ReadableStream<Uint8Array>>;
    private getAuthHeaders;
    private doFetch;
}
export declare class HttpError extends Error {
    readonly statusCode: number;
    readonly body: string;
    constructor(statusCode: number, body: string);
}
export declare class AuthenticationRequiredError extends Error {
    constructor();
}
export declare class RateLimitedError extends Error {
    readonly retryAfterSeconds: number;
    constructor(retryAfterSeconds: number);
}
