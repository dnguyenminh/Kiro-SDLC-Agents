/**
 * BackendProcess — child_process spawn/kill wrapper.
 * Manages the Backend server as a child process.
 * Implements: Factory pattern for platform-specific process creation.
 */

import { spawn, ChildProcess } from 'child_process';
import type { BackendConfiguration } from '../types/config';
import type { OutputChannel } from 'vscode';

export class BackendProcess {
  private process: ChildProcess | null = null;
  private config: BackendConfiguration;
  private outputChannel: OutputChannel;

  constructor(config: BackendConfiguration, outputChannel: OutputChannel) {
    this.config = config;
    this.outputChannel = outputChannel;
  }

  async spawn(): Promise<number> {
    const backendPath = this.config.path || this.detectBackendPath();

    if (!backendPath) {
      throw new Error('Backend path not configured and could not be auto-detected');
    }

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn('node', [backendPath], {
          env: {
            ...process.env,
            CODE_INTEL_PORT: String(this.config.port),
            CODE_INTEL_HOST: this.config.host,
          },
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
        });

        this.process.stdout?.on('data', (data) => {
          this.outputChannel.appendLine(`[Backend] ${data.toString().trim()}`);
        });

        this.process.stderr?.on('data', (data) => {
          this.outputChannel.appendLine(`[Backend ERROR] ${data.toString().trim()}`);
        });

        this.process.on('error', (err) => {
          this.outputChannel.appendLine(`[Backend] Process error: ${err.message}`);
          reject(err);
        });

        this.process.on('exit', (code, signal) => {
          this.outputChannel.appendLine(`[Backend] Process exited (code=${code}, signal=${signal})`);
          this.process = null;
        });

        if (this.process.pid) {
          resolve(this.process.pid);
        } else {
          reject(new Error('Failed to get process PID'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  get pid(): number | null {
    return this.process?.pid ?? null;
  }

  private detectBackendPath(): string | null {
    // Try common locations relative to extension
    const candidates = [
      '../backend/dist/index.js',
      '../backend/src/index.ts',
    ];

    // In production, the backend would be in a known location
    // For development, use the first candidate
    return candidates[0] || null;
  }
}
