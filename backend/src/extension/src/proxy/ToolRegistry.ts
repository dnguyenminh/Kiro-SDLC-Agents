/**
 * ToolRegistry — caches tool metadata fetched from Backend.
 * Implements TDD §4.1 ToolRegistry.
 */

import { ToolDefinition, ToolRegistryEntry } from '../types/proxy';

export class ToolRegistry {
  private readonly tools: Map<string, ToolRegistryEntry> = new Map();

  update(definitions: ToolDefinition[]): void {
    // Mark all existing as unregistered
    for (const entry of this.tools.values()) {
      entry.registered = false;
    }

    // Update/add from new list
    for (const def of definitions) {
      this.tools.set(def.name, { ...def, registered: true });
    }

    // Remove tools no longer in backend
    for (const [name, entry] of this.tools) {
      if (!entry.registered) {
        this.tools.delete(name);
      }
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

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(({ registered, ...def }) => def);
  }

  get size(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }
}
