/**
 * Orchestration engine — coordinator that wires all components together.
 * Behavioral parity with Kotlin OrchestrationEngine.kt.
 */
import { OrchestrationConfig } from './config.js';
import { UnifiedRegistry } from './registry/index.js';
import { ToolMetrics } from './routing/index.js';
import { MetaToolDispatcher } from './meta/dispatcher.js';
import { AdaptiveTokenCache, KbCacheLookup, KbCacheWriter, KbCacheInvalidator, KbInjectionEngine, KbCacheConfig } from './cache/index.js';
import { ModelManager } from './models/index.js';
import { EmbeddingSearcher } from './embedding/index.js';
export declare class OrchestrationEngine {
    readonly metaToolDispatcher: MetaToolDispatcher;
    private config;
    private memoryEngine;
    private appConfig;
    private serverManager;
    private routingTable;
    private registry;
    private router;
    private autoLogger;
    private configWatcher;
    private started;
    private findToolsDelegates;
    private toolMapping;
    private tokenCache;
    private modelManager;
    private embeddingSearcher;
    private kbCacheLookup;
    private kbCacheWriter;
    private kbCacheInvalidator;
    private kbInjectionEngine;
    private kbCacheConfig;
    constructor(config: OrchestrationConfig, memoryEngine: any, appConfig: any);
    /** Start orchestration — spawn servers, build routing, ingest KB. */
    start(): Promise<void>;
    /** Stop orchestration. */
    stop(): void;
    /** Route a tool call to the appropriate child server. */
    route(toolName: string, args: Record<string, any>): Promise<string>;
    getRegistry(): UnifiedRegistry;
    getMemoryEngine(): any;
    isEnabled(): boolean;
    /** Lazy-init adaptive token cache. */
    getTokenCache(): AdaptiveTokenCache;
    /** Get embedding searcher (null if ONNX unavailable). */
    getEmbeddingSearcher(): EmbeddingSearcher | null;
    /** Get model manager instance. */
    getModelManager(): ModelManager;
    /** Get KB cache config (lazy-loaded, hot-reloadable). */
    getKbCacheConfig(): KbCacheConfig;
    /** Get KB cache lookup (L2 → L1 cascade). */
    getKbCacheLookup(): KbCacheLookup;
    /** Get KB cache writer (async fire-and-forget). */
    getKbCacheWriter(): KbCacheWriter;
    /** Get KB cache invalidator. */
    getKbCacheInvalidator(): KbCacheInvalidator;
    /** Get KB injection engine for sub-agent prompt enrichment. */
    getKbInjectionEngine(): KbInjectionEngine;
    getStatus(): Record<string, any>;
    getServerStatus(): {
        name: string;
        state: string;
        toolCount: number;
    }[];
    getMetrics(): Map<string, ToolMetrics>;
    /** Retry FAILED servers and rebuild routing if any recover. */
    retryFailedServers(): Promise<string[]>;
    callChild(serverName: string, toolName: string, args: Record<string, any>): Promise<string>;
    getWorkspace(): string;
    /** Get server names that have nested find_tools capability. */
    getFindToolsDelegates(): string[];
    /** Get (serverName, originalName) for a previously discovered nested tool. */
    getToolMapping(toolName: string): [string, string] | null;
    /** Register a tool discovered via nested find_tools delegation. */
    registerNestedTool(uniqueName: string, serverName: string, originalName: string, definition: Record<string, any>): void;
    /** Get all active child server names. */
    getChildServerNames(): string[];
    private buildRoutingTable;
    /** Identify child servers that expose find_tools (nested orchestrators). */
    private buildDelegationList;
    private ingestToolsToKb;
    private startConfigWatcher;
    private onConfigReload;
    private getTimeout;
    private extractText;
}
//# sourceMappingURL=engine.d.ts.map