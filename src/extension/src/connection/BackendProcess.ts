/**
 * BackendProcess — child_process spawn/kill wrapper.
 * Implements TDD §5.4 Factory pattern for process creation.
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface BackendProcessOptions {
  backendPath: string;
  port: number;
  host: string;
  env?: Record<string, string>;
}

export class BackendProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private _pid: number | null = null;

  get pid(): number | null {
    return this._pid;
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  spawn(options: BackendProcessOptions): void {
    if (this.isRunning) {
      return;
    }

    const env = {
      ...process.env,
      ...options.env,
      BACKEND_PORT: String(options.port),
      BACKEND_HOST: options.host,
    };

    this.process = spawn('node', [options.backendPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    this._pid = this.process.pid ?? null;

    this.process.on('exit', (code, signal) => {
      this._pid = null;
      this.process = null;
      this.emit('exit', { code, signal });
    });

    this.process.on('error', (error) => {
      this._pid = null;
      this.process = null;
      this.emit('error', error);
    });

    if (this.process.stdout) {
      this.process.stdout.on('data', (data: Buffer) => {
        this.emit('stdout', data.toString());
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        this.emit('stderr', data.toString());
      });
    }
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      // Force kill after 5s if still running
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  dispose(): void {
    this.kill();
    this.removeAllListeners();
  }
}
