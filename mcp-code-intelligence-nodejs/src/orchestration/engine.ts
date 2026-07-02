/**
 * Orchestration engine — coordinator that wires all components together.
 * Behavioral parity with Kotlin OrchestrationEngine.kt.
 */

import * as path from 'path';
import { OrchestrationConfig, enabledServers } from './config.js';
import { LocalServerManager, ConfigWatcher, ServerState } from './local/index.js';
import { UnifiedRegistry } from './registry/index.js';
import { RoutingTable, SmartRouter, ToolMetrics } from './routing/index.js';
import { AutoLogger } from './logging/auto-logger.js';
import { MetaToolDispatcher } from './meta/dispatcher.js';
import { AdaptiveTokenCache, KbCacheLookup, KbCacheWriter, KbCacheInvalidator, KbInjectionEngine, readKbCacheConfig, KbCacheConfig } from './cache/index.js';
import { ModelManager } from './models/index.js';
import { EmbeddingSearcher } from './embedding/index.js';

export class OrchestrationEngine {
  readonly metaToolDispatcher: MetaToolDispatcher;
  private config: OrchestrationConfig;
  private memoryEngine: any;
  private appConfig: any;
  private serverManager: LocalServerManager;
  private routingTable = new RoutingTable();
  private registry: UnifiedRegistry;
  private router: SmartRouter;
  private autoLogger: AutoLogger;
  private configWatcher: ConfigWatcher | null = null;
  private started = false;
  private findToolsDelegates: string[] = [];
  private toolMapping = new Map<string, [string, string]>();
  private tokenCache: AdaptiveTokenCache | null = null;
  private modelManager: ModelManager | null = null;
  private embeddingSearcher: EmbeddingSearcher | null = null;
  private kbCacheLookup: KbCacheLookup | null = null;
  private kbCacheWriter: KbCacheWriter | null = null;
  private kbCacheInvalidator: KbCacheInvalidator | null = null;
  private kbInjectionEngine: KbInjectionEngine | null = null;
  private kbCacheConfig: KbCacheConfig | null = null;

  constructor(config: OrchestrationConfig, memoryEngine: any, appConfig: any) {
    this.config = config;
    this.memoryEngine = memoryEngine;
    this.appConfig = appConfig;
    this.serverManager = new LocalServerManager(config);
    this.registry = new UnifiedRegistry(config.settings.similarityThreshold);
    this.router = new SmartRouter(this.serverManager, this.routingTable);
    this.autoLogger = new AutoLogger(memoryEngine, config.settings.autoLog);
    this.metaToolDispatcher = new MetaToolDispatcher(this);
  }

  /** Start orchestration — spawn servers, build routing, ingest KB. */
  async start(): Promise<void> {
    const servers = enabledServers(this.config);
    this.registry.setServerOrder([...servers.keys()]);
    const count = await this.serverManager.startAll();
    this.buildRoutingTable();
    this.ingestToolsToKb();
    this.started = true;
    this.startConfigWatcher();
    console.error(`[orchestration] Started: ${count}/${servers.size} servers active`);
  }

  /** Stop orchestration. */
  stop(): void {
    if (!this.started) return;
    this.configWatcher?.stop();
    this.serverManager.stopAll();
    this.started = false;
    console.error('[orchestration] Stopped');
  }

  /** Route a tool call to the appropriate child server. */
  async route(toolName: string, args: Record<string, any>): Promise<string> {
    if (!this.started) throw new Error('Orchestration not started');
    const start = Date.now();
    this.router.requestStartTime = start;
    try {
      const timeout = this.getTimeout(toolName);
      const result = await this.router.route(toolName, args, timeout);
      const latency = Date.now() - start;
      const source = this.serverManager.findServerForTool(toolName) ?? 'unknown';
      this.autoLogger.logCall(toolName, JSON.stringify(args), result, latency, source);
      return result;
    } catch (e: any) {
      const latency = Date.now() - start;
      this.autoLogger.logCall(toolName, JSON.stringify(args), e.message, latency, 'unknown', true);
      throw e;
    }
  }

  getRegistry(): UnifiedRegistry { return this.registry; }
  getMemoryEngine(): any { return this.memoryEngine; }
  isEnabled(): boolean { return this.started; }

  /** Lazy-init adaptive token cache. */
  getTokenCache(): AdaptiveTokenCache {
    if (!this.tokenCache) {
      const cachePath = path.join(this.getWorkspace(), '.code-intel', 'token-cache.json');
      this.tokenCache = new AdaptiveTokenCache(cachePath);
    }
    return this.tokenCache;
  }

  /** Get embedding searcher (null if ONNX unavailable). */
  getEmbeddingSearcher(): EmbeddingSearcher | null {
    if (!this.embeddingSearcher) {
      try {
        this.embeddingSearcher = new EmbeddingSearcher(this.getModelManager(), this.registry);
      } catch { return null; }
    }
    return this.embeddingSearcher;
  }

  /** Get model manager instance. */
  getModelManager(): ModelManager {
    if (!this.modelManager) this.modelManager = new ModelManager();
    return this.modelManager;
  }

  /** Get KB cache config (lazy-loaded, hot-reloadable). */
  getKbCacheConfig(): KbCacheConfig {
    if (!this.kbCacheConfig) {
      const configPath = path.join(this.getWorkspace(), '.code-intel', 'orchestration.json');
      this.kbCacheConfig = readKbCacheConfig(configPath);
    }
    return this.kbCacheConfig;
  }

  /** Get KB cache lookup (L2 → L1 cascade). */
  getKbCacheLookup(): KbCacheLookup {
    if (!this.kbCacheLookup) {
      this.kbCacheLookup = new KbCacheLookup(this.memoryEngine, this.getKbCacheConfig());
    }
    return this.kbCacheLookup;
  }

  /** Get KB cache writer (async fire-and-forget). */
  getKbCacheWriter(): KbCacheWriter {
    if (!this.kbCacheWriter) {
      this.kbCacheWriter = new KbCacheWriter(this.memoryEngine, this.getKbCacheConfig());
    }
    return this.kbCacheWriter;
  }

  /** Get KB cache invalidator. */
  getKbCacheInvalidator(): KbCacheInvalidator {
    if (!this.kbCacheInvalidator) {
      this.kbCacheInvalidator = new KbCacheInvalidator(this.memoryEngine);
    }
    return this.kbCacheInvalidator;
  }

  /** Get KB injection engine for sub-agent prompt enrichment. */
  getKbInjectionEngine(): KbInjectionEngine {
    if (!this.kbInjectionEngine) {
      this.kbInjectionEngine = new KbInjectionEngine(this.memoryEngine, this.getKbCacheConfig());
    }
    return this.kbInjectionEngine;
  }

  getStatus(): Record<string, any> {
    return {
      enabled: this.started,
      servers: this.serverManager.getStatus().size,
      hiddenTools: this.registry.allChildTools().length,
    };
  }

  getServerStatus() { return this.serverManager.getServerStatusInfo(); }
  getMetrics(): Map<string, ToolMetrics> { return this.router.getMetrics(); }

  /** Retry FAILED servers and rebuild routing if any recover. */
  async retryFailedServers(): Promise<string[]> {
    const recovered = await this.serverManager.retryFailedServers();
    if (recovered.length > 0) {
      this.buildRoutingTable();
      console.error(`[orchestration] Recovered servers: [${recovered.join(', ')}] — routing rebuilt`);
    }
    return recovered;
  }

  async callChild(serverName: string, toolName: string, args: Record<string, any>): Promise<string> {
    const result = await this.serverManager.callTool(serverName, toolName, args, 30_000);
    return this.extractText(result);
  }

  getWorkspace(): string { return this.appConfig?.workspace ?? ''; }

  /** Get server names that have nested find_tools capability. */
  getFindToolsDelegates(): string[] { return this.findToolsDelegates; }

  /** Get (serverName, originalName) for a previously discovered nested tool. */
  getToolMapping(toolName: string): [string, string] | null {
    return this.toolMapping.get(toolName) ?? null;
  }

  /** Register a tool discovered via nested find_tools delegation. */
  registerNestedTool(uniqueName: string, serverName: string, originalName: string, definition: Record<string, any>): void {
    this.toolMapping.set(uniqueName, [serverName, originalName]);
    this.toolMapping.set(originalName, [serverName, originalName]);
    this.registry.registerNested(uniqueName, serverName, definition);
    this.routingTable.addRoute(originalName, serverName);
  }

  /** Get all active child server names. */
  getChildServerNames(): string[] {
    const status = this.serverManager.getStatus();
    const result: string[] = [];
    for (const [name, state] of status) {
      if (state === ServerState.ACTIVE) result.push(name);
    }
    return result;
  }

  private buildRoutingTable(): void {
    const allTools = this.serverManager.getAllTools();
    const byServer = new Map<string, Record<string, any>[]>();
    for (const [name, tool] of allTools) {
      const list = byServer.get(name) ?? [];
      list.push(tool);
      byServer.set(name, list);
    }
    for (const [serverName, tools] of byServer) {
      this.registry.setChildTools(serverName, tools);
    }
    this.routingTable.rebuild(new Set(), this.registry.childToolsByServer());
    this.buildDelegationList(allTools);
  }

  /** Identify child servers that expose find_tools (nested orchestrators). */
  private buildDelegationList(allTools: Array<[string, Record<string, any>]>): void {
    this.findToolsDelegates = [];
    const serversWithFind = new Set<string>();
    for (const [serverName, toolDef] of allTools) {
      if (toolDef.name === 'find_tools') serversWithFind.add(serverName);
    }
    this.findToolsDelegates = [...serversWithFind];
    console.error(`[orchestration] Delegation list: find_tools → [${this.findToolsDelegates.join(', ')}]`);
  }

  private ingestToolsToKb(): void {
    if (!this.memoryEngine) return;
    const tools = this.registry.allChildTools();
    if (tools.length === 0) return;

    // Batch ingestion: single insert with combined content (avoids N individual transactions)
    const BATCH_SIZE = 50;
    let ingested = 0;
    try {
      for (let i = 0; i < tools.length; i += BATCH_SIZE) {
        const batch = tools.slice(i, i + BATCH_SIZE);
        const content = batch.map((t) => `${t.name} [${t.source}]: ${t.definition.description ?? ''}`).join('\n');
        this.memoryEngine.knowledge.insert({
          content, summary: `Orchestration tools batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} tools)`,
          type: 'CONTEXT', tier: 'WORKING', source: 'orchestration-startup', tags: 'tools,registry,orchestration',
        });
        ingested += batch.length;
      }
      console.error(`[orchestration] Ingested ${ingested} child tool definitions into KB (${Math.ceil(tools.length / BATCH_SIZE)} batches)`);
    } catch (e: any) {
      console.error(`[orchestration] Failed to ingest tools to KB: ${e.message}`);
    }
  }

  private startConfigWatcher(): void {
    const workspace = this.getWorkspace();
    const configPath = path.join(workspace, '.code-intel', 'orchestration.json');
    this.configWatcher = new ConfigWatcher(configPath, (newConfig) => this.onConfigReload(newConfig));
    this.configWatcher.start();
  }

  private async onConfigReload(newConfig: OrchestrationConfig): Promise<void> {
    this.config = newConfig;
    this.serverManager.stopAll();
    this.serverManager.updateConfig(newConfig);
    this.registry.setServerOrder([...enabledServers(newConfig).keys()]);
    await this.serverManager.startAll();
    this.buildRoutingTable();
    this.ingestToolsToKb();
  }

  private getTimeout(toolName: string): number {
    const serverName = this.serverManager.findServerForTool(toolName);
    if (serverName && this.config.mcpServers[serverName]) return this.config.mcpServers[serverName].timeout;
    return 30_000;
  }

  private extractText(result: any): string {
    if (!result) return '{}';
    if (Array.isArray(result?.content) && result.content.length > 0) return result.content[0]?.text ?? '{}';
    return JSON.stringify(result);
  }
}
