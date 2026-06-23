/**
 * httpStream MCP server process — connects to upstream MCP server via HTTP POST.
 * Same state machine as ServerProcess (stdio), but no child process spawning.
 * Behavioral parity with Kotlin HttpStreamProcess.kt.
 */

import { ServerEntry } from '../config.js';
import { ServerState } from './process.js';
import { HttpJsonRpc } from './http-json-rpc.js';
import { IServerProcess } from './transport.js';

export class HttpStreamProcess implements IServerProcess {
  readonly name: string;
  state: ServerState = ServerState.STARTING;
  tools: Record<string, any>[] = [];
  retryCount = 0;
  private rpc: HttpJsonRpc;
  private entry: ServerEntry;

  constructor(name: string, entry: ServerEntry) {
    this.name = name;
    this.entry = entry;
    this.rpc = new HttpJsonRpc(entry.url!);
  }

  /** Connect to httpStream server, initialize MCP handshake, fetch tools. */
  async start(): Promise<boolean> {
    this.state = ServerState.STARTING;
    this.log(`Connecting to ${this.entry.url}`);

    if (!await this.initialize()) return this.markFailed(`Initialize handshake failed at ${this.entry.url}`);
    this.state = ServerState.READY;

    if (!await this.fetchTools()) return this.markFailed('Failed to fetch tools');
    this.state = ServerState.ACTIVE;
    this.log(`Active with ${this.tools.length} tools`);
    return true;
  }

  /** Stop — no process to kill, just mark dead. */
  stop(): void {
    this.state = ServerState.DEAD;
    this.log('Stopped');
  }

  /** Restart — re-create RPC client and re-initialize. */
  async restart(maxRetries: number): Promise<boolean> {
    if (this.retryCount >= maxRetries) { this.state = ServerState.DEAD; return false; }
    this.state = ServerState.RESTARTING;
    this.retryCount++;
    const backoffMs = Math.min(1000 * this.retryCount, 10_000);
    this.log(`Restarting (attempt ${this.retryCount}/${maxRetries}, backoff ${backoffMs}ms)`);
    await new Promise((r) => setTimeout(r, backoffMs));
    // Re-create RPC client (fresh session)
    this.rpc = new HttpJsonRpc(this.entry.url!);
    return this.start();
  }

  /** Call a tool on this httpStream server via HTTP POST. */
  async callTool(toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any> {
    return this.rpc.sendRequest('tools/call', { name: toolName, arguments: args }, timeoutMs);
  }

  /** Health check — send tools/list via HTTP, expect response within 5s. */
  async healthCheck(): Promise<boolean> {
    try { await this.rpc.sendRequest('tools/list', {}, 5_000); return true; }
    catch { return false; }
  }

  /** No OS process — alive means state is ACTIVE. */
  isAlive(): boolean { return this.state === ServerState.ACTIVE; }

  private async initialize(): Promise<boolean> {
    const params = {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-orchestrator', version: '1.0.0' },
    };
    try {
      await this.rpc.sendRequest('initialize', params, this.entry.timeout);
      this.rpc.sendNotification('notifications/initialized', {});
      return true;
    } catch (e: any) {
      this.log(`Initialize failed: ${e.message}`);
      return false;
    }
  }

  private async fetchTools(): Promise<boolean> {
    try {
      const result = await this.rpc.sendRequest('tools/list', {}, this.entry.timeout);
      this.tools = result?.tools ?? [];
      return true;
    } catch (e: any) {
      this.log(`Fetch tools failed: ${e.message}`);
      return false;
    }
  }

  private markFailed(reason: string): boolean {
    this.log(reason);
    this.state = ServerState.FAILED;
    return false;
  }

  private log(msg: string): void { console.error(`[${this.name}] ${msg}`); }
}
