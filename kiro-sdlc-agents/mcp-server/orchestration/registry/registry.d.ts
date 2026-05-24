/**
 * Unified registry — merges native + child server tools into a searchable index.
 * Supports fallback chains, tokenized search, hit tracking, and session toggles.
 * Behavioral parity with Kotlin UnifiedRegistry.kt.
 */
import { RegisteredTool, ToolChain } from './grouper.js';
export declare class UnifiedRegistry {
    private similarityThreshold;
    private nativeTools;
    private childTools;
    private merged;
    private toggles;
    private chains;
    private serverOrder;
    private hits;
    constructor(similarityThreshold?: number);
    setServerOrder(order: string[]): void;
    /** Register tools from a child server (filters meta-tools). */
    setChildTools(serverName: string, tools: Record<string, any>[]): void;
    /** Tokenized search — scores by relevance + popularity. */
    search(query: string): RegisteredTool[];
    find(name: string): RegisteredTool | null;
    /** Compute deterministic hash of current tool registry state. */
    versionHash(): string;
    getChain(toolName: string): ToolChain | null;
    recordHit(toolName: string, weight?: number): void;
    toggle(toolName: string, enabled: boolean): void;
    resetToggles(): void;
    isEnabled(toolName: string): boolean;
    getAll(): Record<string, any>[];
    childToolsByServer(): Map<string, string[]>;
    allChildTools(): RegisteredTool[];
    /** Register a tool discovered via nested find_tools delegation. */
    registerNested(uniqueName: string, serverName: string, definition: Record<string, any>): void;
    private combinedScore;
    private scoreAgainstTerms;
    private applyDecay;
    private rebuild;
}
//# sourceMappingURL=registry.d.ts.map