/**
 * Single child MCP server process lifecycle — spawn, initialize, fetch tools, health check.
 * State machine: STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD.
 * Behavioral parity with Kotlin ServerProcess.kt.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { ServerEntry } from '../config.js';
import { StdioJsonRpc } from './rpc.js';

export enum ServerState {
  STARTING = 'STARTING', READY = 'READY', ACTIVE = 'ACTIVE',
  CRASHED = 'CRASHED', RESTARTING = 'RESTARTING',
  STOPPING = 'STOPPING', DEAD = 'DEAD', FAILED = 'FAILED',
}

export class ServerProcess {
  readonly name: string;
  state: ServerState = ServerState.STARTING;
  tools: Record<string, any>[] = [];
  retryCount = 0;
  readonly rpc = new StdioJsonRpc();
  private proc: ChildProcess | null = null;
  private entry: ServerEntry;

  constructor(name: string, entry: ServerEntry) {
    this.name = name;
    this.entry = entry;
  }

  /** Start child process, initialize MCP handshake, fetch tools. */
  async start(): Promise<boolean> {
    this.state = ServerState.STARTING;
    const proc = this.spawnProcess();
    if (!proc) return this.markFailed('Failed to spawn process');
    this.proc = proc;
    this.rpc.attach(proc);
    if (!await this.initialize()) return this.markFailed('Initialize handshake failed');
    this.state = ServerState.READY;
    if (!await this.fetchTools()) return this.markFailed('Failed to fetch tools');
    this.state = ServerState.ACTIVE;
    this.log(`Active with ${this.tools.length} tools`);
    return true;
  }

  /** Stop child process gracefully. */
  stop(): void {
    this.state = ServerState.STOPPING;
    this.rpc.detach();
    this.destroyProcess();
    this.state = ServerState.DEAD;
    this.log('Stopped');
  }

  /** Restart after crash with exponential backoff. */
  async restart(maxRetries: number): Promise<boolean> {
    if (this.retryCount >= maxRetries) { this.state = ServerState.DEAD; return false; }
    this.state = ServerState.RESTARTING;
    this.retryCount++;
    const backoffMs = Math.min(1000 * this.retryCount, 10_000);
    this.log(`Restarting (attempt ${this.retryCount}/${maxRetries}, backoff ${backoffMs}ms)`);
    await new Promise((r) => setTimeout(r, backoffMs));
    this.destroyProcess();
    return this.start();
  }

  /** Call a tool on this child server via JSON-RPC. */
  async callTool(toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any> {
    return this.rpc.sendRequest('tools/call', { name: toolName, arguments: args }, timeoutMs);
  }

  /** Health check — send tools/list, expect response within 5s. */
  async healthCheck(): Promise<boolean> {
    try { await this.rpc.sendRequest('tools/list', {}, 5_000); return true; }
    catch { return false; }
  }

  /** Check if OS process is still alive. */
  isAlive(): boolean { return this.proc !== null && this.proc.exitCode === null; }

  private spawnProcess(): ChildProcess | null {
    try {
      const isWin = process.platform === 'win32';
      return spawn(this.entry.command, this.entry.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...this.entry.env },
        shell: isWin,
      });
    } catch (e: any) {
      this.log(`Spawn failed: ${e.message}`);
      return null;
    }
  }

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

  private destroyProcess(): void {
    const proc = this.proc;
    if (!proc) return;
    if (proc.exitCode === null) {
      if (!this.tryWindowsTreeKill(proc)) proc.kill('SIGKILL');
    }
    this.proc = null;
  }

  private tryWindowsTreeKill(proc: ChildProcess): boolean {
    if (process.platform !== 'win32') return false;
    try {
      execSync(`taskkill /T /F /PID ${proc.pid}`, { timeout: 3000 });
      return true;
    } catch { return false; }
  }

  private markFailed(reason: string): boolean {
    this.log(reason);
    this.state = ServerState.FAILED;
    return false;
  }

  private log(msg: string): void { console.error(`[${this.name}] ${msg}`); }
}
