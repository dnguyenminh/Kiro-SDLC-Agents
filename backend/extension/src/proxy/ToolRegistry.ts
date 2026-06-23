/**
 * ToolRegistry — local cache of tool metadata fetched from Backend.
 */

import type { ToolDefinition } from '../types/proxy';

export interface ToolRegistryEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: string;
  registered: boolean;
}

export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();

  loadFromBackend(tools: ToolDefinition[]): void {
    this.tools.clear();
    for (const tool of tools) {
      this.tools.set(tool.name, {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        category: tool.category,
        registered: true,
      });
    }
  }

  get(name: string): ToolRegistryEntry | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  get size(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }
}
