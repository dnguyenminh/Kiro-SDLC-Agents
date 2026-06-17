/**
 * Backend tool types.
 * Implements TDD §5.3 Backend Interfaces.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    category: 'memory' | 'code' | 'orchestration' | 'utility';
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
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;
export interface ToolCallRequest {
    tool_name: string;
    arguments: Record<string, unknown>;
}
export interface ToolListResponse {
    tools: ToolDefinition[];
}
//# sourceMappingURL=tool.d.ts.map