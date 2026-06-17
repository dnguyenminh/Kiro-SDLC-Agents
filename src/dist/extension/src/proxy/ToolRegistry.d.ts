/**
 * ToolRegistry — caches tool metadata fetched from Backend.
 * Implements TDD §4.1 ToolRegistry.
 */
import { ToolDefinition, ToolRegistryEntry } from '../types/proxy';
export declare class ToolRegistry {
    private readonly tools;
    update(definitions: ToolDefinition[]): void;
    get(name: string): ToolRegistryEntry | undefined;
    has(name: string): boolean;
    getAll(): ToolRegistryEntry[];
    getDefinitions(): ToolDefinition[];
    get size(): number;
    clear(): void;
}
//# sourceMappingURL=ToolRegistry.d.ts.map