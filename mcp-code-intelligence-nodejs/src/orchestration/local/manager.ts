/**
 * Local server manager — manages multiple child MCP server processes.
 * Behavioral parity with Kotlin LocalServerManager.kt.
 */

import { OrchestrationConfig, ServerEntry, enabledServers } from '../config.js';
import { ServerProcess, ServerState } from './process.js';

export class LocalServerManager {
  private config: OrchestrationConfig;
  private servers = new Map<string, ServerProcess>();
  private healthInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: OrchestrationConfig) { this.config = config; }

  updateConfig(newConfig: OrchestrationConfig): void { this.config = newConfig; }

  /** Start all enabled servers. Returns count of successfully started. */
  async startAll(): Promise<number> {
    const entries = enabledServers(this.config);
    console.error(`[orchestration] Starting ${entries.size} child servers...`);
    let started = 0;
    for (const [name, entry] of entries) {
      const server = new ServerProcess(name, entry);
      this.servers.set(name, server);
      if (await server.start()) started++;
      else console.error(`[${name}] Failed to start`);
    }
    this.startHealthMonitor();
    return started;
  }

  /** Stop all child servers gracefully. */
  stopAll(): void {
    if (this.healthInterval) { clearInterval(this.healthInterval); this.healthInterval = null; }
    for (const server of this.servers.values()) server.stop();
    this.servers.clear();
    console.error('[orchestration] All child servers stopped');
  }

  /** Call a tool on the specified server. */
  async callTool(serverName: string, toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server) throw new Error(`Server '${serverName}' not found (tool: '${toolName}')`);
    if (server.state !== ServerState.ACTIVE) throw new Error(`Server '${serverName}' is ${server.state}`);
    return server.callTool(toolName, args, timeoutMs);
  }

  /** Find which server owns a given tool name. */
  findServerForTool(toolName: string): string | null {
    for (const [name, server] of this.servers) {
      if (server.state !== ServerState.ACTIVE) continue;
      if (server.tools.some((t) => t.name === toolName)) return name;
    }
    return null;
  }

  /** Get all tools from all active child servers. */
  getAllTools(): Array<[string, Record<string, any>]> {
    const result: Array<[string, Record<string, any>]> = [];
    for (const [name, server] of this.servers) {
      if (server.state === ServerState.ACTIVE) {
        for (const tool of server.tools) result.push([name, tool]);
      }
    }
    return result;
  }

  /** Get status of all managed servers. */
  getStatus(): Map<string, ServerState> {
    const result = new Map<string, ServerState>();
    for (const [name, server] of this.servers) result.set(name, server.state);
    return result;
  }

  /** Get detailed status info. */
  getServerStatusInfo(): Array<{ name: string; state: string; toolCount: number }> {
    return [...this.servers.entries()].map(([name, s]) => ({
      name, state: s.state, toolCount: s.tools.length,
    }));
  }

  private startHealthMonitor(): void {
    const intervalMs = this.config.settings.healthCheckIntervalMs;
    this.healthInterval = setInterval(() => this.checkHealth(), intervalMs);
  }

  private async checkHealth(): Promise<void> {
    for (const server of this.servers.values()) {
      if (server.state !== ServerState.ACTIVE) continue;
      if (!server.isAlive() || !await server.healthCheck()) {
        console.error(`[${server.name}] Unhealthy — attempting restart`);
        const maxRetries = this.config.settings.maxRestartRetries;
        if (!await server.restart(maxRetries)) {
          console.error(`[${server.name}] Permanently dead after ${maxRetries} retries`);
        }
      }
    }
  }
}
