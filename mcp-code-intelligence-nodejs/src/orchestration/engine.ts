/**
 * Orchestration engine — coordinator that wires all components together.
 * Behavioral parity with Kotlin OrchestrationEngine.kt.
 */

import * as path from 'path';
import { OrchestrationConfig, enabledServers } from './config.js';
import { LocalServerManager, ConfigWatcher } from './local/index.js';
import { UnifiedRegistry } from './registry/index.js';
import { RoutingTable, SmartRouter, ToolMetrics } from './routing/index.js';
import { AutoLogger } from './logging/auto-logger.js';
import { MetaToolDispatcher } from './meta/dispatcher.js';

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

  getStatus(): Record<string, any> {
    return {
      enabled: this.started,
      servers: this.serverManager.getStatus().size,
      hiddenTools: this.registry.allChildTools().length,
    };
  }

  getServerStatus() { return this.serverManager.getServerStatusInfo(); }
  getMetrics(): Map<string, ToolMetrics> { return this.router.getMetrics(); }

  async callChild(serverName: string, toolName: string, args: Record<string, any>): Promise<string> {
    const result = await this.serverManager.callTool(serverName, toolName, args, 30_000);
    return this.extractText(result);
  }

  getWorkspace(): string { return this.appConfig?.workspace ?? ''; }

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
  }

  private ingestToolsToKb(): void {
    if (!this.memoryEngine) return;
    const tools = this.registry.allChildTools();
    if (tools.length === 0) return;
    const content = tools.map((t) => `${t.name} [${t.source}]: ${t.definition.description ?? ''}`).join('\n');
    try {
      this.memoryEngine.knowledge.insert({
        content, summary: `Orchestration child tools registry (${tools.length} tools)`,
        type: 'CONTEXT', tier: 'WORKING', source: 'orchestration-startup', tags: 'tools,registry,orchestration',
      });
      console.error(`[orchestration] Ingested ${tools.length} child tool definitions into KB`);
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
