/**
 * JSON-RPC 2.0 over stdio pipes — sends requests to child process stdin,
 * reads responses from child process stdout.
 * Behavioral parity with Kotlin StdioJsonRpc.kt.
 */

import * as readline from 'readline';
import { ChildProcess } from 'child_process';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class StdioJsonRpc {
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private proc: ChildProcess | null = null;
  private rl: readline.Interface | null = null;

  /** Attach to a child process's stdin/stdout. Starts reader. */
  attach(proc: ChildProcess): void {
    this.proc = proc;
    if (!proc.stdout) throw new Error('Process has no stdout');
    this.rl = readline.createInterface({ input: proc.stdout, terminal: false });
    this.rl.on('line', (line) => this.handleIncoming(line));
  }

  /** Detach from process — close reader, reject pending. */
  detach(): void {
    if (this.rl) { this.rl.close(); this.rl = null; }
    this.proc = null;
    this.rejectAll('Connection closed');
  }

  /** Send JSON-RPC request and await response with timeout. */
  async sendRequest(method: string, params: any, timeoutMs: number): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout after ${timeoutMs}ms waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.writeMessage({ jsonrpc: '2.0', id, method, params });
    });
  }

  /** Send JSON-RPC notification (no response expected). */
  sendNotification(method: string, params: any): void {
    this.writeMessage({ jsonrpc: '2.0', method, params });
  }

  /** Reject all pending requests. */
  rejectAll(reason: string): void {
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private handleIncoming(line: string): void {
    if (!line.trim()) return;
    let msg: any;
    try { msg = JSON.parse(line); } catch { return; }
    const id = msg.id;
    if (id != null) this.resolveResponse(id, msg);
  }

  private resolveResponse(id: number, response: any): void {
    const req = this.pending.get(id);
    if (!req) return;
    this.pending.delete(id);
    clearTimeout(req.timer);
    if (response.error) {
      req.reject(new Error(response.error.message ?? 'Unknown error'));
    } else {
      req.resolve(response.result);
    }
  }

  private writeMessage(msg: any): void {
    if (!this.proc?.stdin) throw new Error('Not attached to process');
    this.proc.stdin.write(JSON.stringify(msg) + '\n');
  }
}
