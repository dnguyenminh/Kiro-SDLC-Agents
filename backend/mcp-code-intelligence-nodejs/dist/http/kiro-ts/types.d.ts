/**
 * kiro-ts Types — KSA-237
 * TypeScript interfaces for the Anthropic-compatible chat proxy.
 */
export interface AnthropicRequest {
    model: string;
    messages: AnthropicMessage[];
    max_tokens: number;
    stream?: boolean;
    system?: string;
    temperature?: number;
    tools?: ToolDefinition[];
    tool_choice?: ToolChoice;
    stop_sequences?: string[];
    metadata?: Record<string, unknown>;
    sessionId?: string;
    toolResult?: ToolResultInput;
}
export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
}
export interface ContentBlock {
    type: 'text' | 'tool_use' | 'tool_result' | 'image' | 'thinking';
    text?: string;
    thinking?: string;
    id?: string;
    name?: string;
    input?: unknown;
    tool_use_id?: string;
    content?: string;
    is_error?: boolean;
    source?: {
        type?: string;
        media_type?: string;
        data?: string;
    };
}
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}
export interface ToolChoice {
    type: 'auto' | 'any' | 'tool';
    name?: string;
}
export interface ToolResultInput {
    toolUseId: string;
    content: string;
    isError?: boolean;
}
export interface AuthResult {
    mode: 'api_key' | 'kiro';
    apiKey?: string;
    credentials?: AWSCredentials;
    region?: string;
    apiRegion?: string;
    bearerToken?: string;
    refreshToken?: string;
    profileArn?: string;
}
export interface AWSCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: Date;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    credentials: {
        status: 'ok' | 'failed' | 'not_configured';
        type?: 'kiro' | 'api_key';
        expires_in?: string;
        error?: string;
    };
    api_connectivity: {
        status: 'ok' | 'failed';
        latency_ms?: number;
        error?: string;
    };
    model_available: {
        status: 'ok' | 'failed';
        model?: string;
        error?: string;
    };
    api_region?: string;
    timestamp: string;
}
export interface SSEEvent {
    event: string;
    data: unknown;
}
export interface AnthropicError {
    type: 'error';
    error: {
        type: 'invalid_request_error' | 'authentication_error' | 'api_error' | 'rate_limit_error' | 'tool_use_id_mismatch';
        message: string;
        [key: string]: unknown;
    };
}
export interface ProxyOptions {
    targetUrl: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
}
//# sourceMappingURL=types.d.ts.map