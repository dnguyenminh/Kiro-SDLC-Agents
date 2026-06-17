/**
 * Extension type definitions — proxy and tool registry.
 */

export interface ToolRegistryEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: 'memory' | 'code' | 'orchestration' | 'analytics' | 'kb-graph' | 'utility';
  registered: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: string;
}

export interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  isError: boolean;
}

export interface ProxyRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timestamp: number;
  status: 'PENDING' | 'IN_FLIGHT' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';
  responseTime?: number;
}
