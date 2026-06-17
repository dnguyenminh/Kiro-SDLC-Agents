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
export declare class HttpClient {
    private readonly config;
    constructor(config: HttpClientConfig);
    health(): Promise<HealthResponse>;
    listTools(): Promise<ToolListResponse>;
    callTool(request: ToolCallRequest): Promise<ToolResult>;
    fetchWebviewData<T>(path: string): Promise<T>;
    postWebviewData<T>(path: string, body: unknown): Promise<T>;
    private doFetch;
}
export declare class HttpError extends Error {
    readonly statusCode: number;
    readonly body: string;
    constructor(statusCode: number, body: string);
}
//# sourceMappingURL=HttpClient.d.ts.map