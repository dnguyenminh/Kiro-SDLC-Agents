/**
 * McpProvider — MCP resource discovery
 * KSA-252
 */

import type { McpResourceItem } from '../../shared/protocol';

interface ExtensionContext {
  getMcpResources(): Array<{ server: string; name: string; type: string; description?: string }>;
}

export class McpProvider {
  private context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  async getResources(): Promise<McpResourceItem[]> {
    try {
      const raw = this.context.getMcpResources();
      return raw.map(r => ({
        server: r.server,
        name: r.name,
        type: r.type as 'tool' | 'resource' | 'prompt',
        description: r.description,
      }));
    } catch {
      return [];
    }
  }

  async getResourceContent(server: string, resource: string): Promise<string> {
    // In real implementation, this would call the MCP server
    return `[MCP Resource: ${server}/${resource}]`;
  }
}
