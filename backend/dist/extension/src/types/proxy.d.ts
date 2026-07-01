/**
 * Proxy types for MCP tool forwarding.
 * Implements TDD §4.1 ToolRegistry and ProxyRequest.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    category: 'memory' | 'code' | 'orchestration' | 'utility';
}
export interface ToolRegistryEntry extends ToolDefinition {
    registered: boolean;
}
export interface ProxyRequest {
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
    timestamp: number;
    status: 'PENDING' | 'IN_FLIGHT' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';
    responseTime?: number;
}
export interface ToolCallRequest {
    tool_name: string;
    arguments: Record<string, unknown>;
}
export interface ContentBlock {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
}
export interface ToolResult {
    content: ContentBlock[];
    isError: boolean;
}
export interface ToolListResponse {
    tools: ToolDefinition[];
}
export interface ToolCallError {
    code: string;
    message: string;
}
