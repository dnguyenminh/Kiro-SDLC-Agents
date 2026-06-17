/**
 * ConnectionManager — manages the connection lifecycle to the Backend.
 * Implements state machine: DISCONNECTED -> STARTING -> CONNECTING -> CONNECTED
 * Handles health checks, reconnection with exponential backoff, and process spawning.
 * Implements: UC-1, UC-3, UC-4
 */

import * as vscode from 'vscode';
import type { ConnectionState, ConnectionStateType, HealthResponse } from '../types/connection';
import { DEFAULT_CONNECTION_STATE } from '../types/connection';
import type { BackendConfiguration } from '../types/config';
import { HttpClient } from '../proxy/HttpClient';
import { BackendProcess } from './BackendProcess';

export class ConnectionManager implements vscode.Disposable {
  private state: ConnectionState = { ...DEFAULT_CONNECTION_STATE };
  private healthTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private httpClient: HttpClient;
  private backendProcess: BackendProcess | null = null;
  private stateListeners: Array<(state: ConnectionState) => void> = [];
  private outputChannel: vscode.OutputChannel;
  private config: BackendConfiguration;

  constructor(config: BackendConfiguration, outputChannel: vscode.OutputChannel) {
    this.config = config;
    this.outputChannel = outputChannel;
    this.httpClient = new HttpClient(`http://${config.host}:${config.port}`);
  }

  get currentState(): ConnectionState {
    return { ...this.state };
  }

  get client(): HttpClient {
    return this.httpClient;
  }

  onStateChange(listener: (state: ConnectionState) => void): vscode.Disposable {
    this.stateListeners.push(listener);
    return new vscode.Disposable(() => {
      const idx = this.stateListeners.indexOf(listener);
      if (idx >= 0) this.stateListeners.splice(idx, 1);
    });
  }

  async connect(): Promise<void> {
    if (this.state.state === 'CONNECTED') return;

    // Try to connect to existing Backend first
    this.setState('CONNECTING');

    try {
      const health = await this.httpClient.healthCheck();
      this.handleHealthSuccess(health as HealthResponse);
      return;
    } catch {
      // Backend not running — try to start if autoStart is enabled
      if (this.config.autoStart) {
        await this.startBackend();
      } else {
        this.setState('DISCONNECTED');
      }
    }
  }

  private async startBackend(): Promise<void> {
    this.setState('STARTING');
    this.outputChannel.appendLine('[ConnectionManager] Starting Backend process...');

    try {
      this.backendProcess = new BackendProcess(this.config, this.outputChannel);
      const pid = await this.backendProcess.spawn();
      this.state.backendPid = pid;
      this.outputChannel.appendLine(`[ConnectionManager] Backend started with PID ${pid}`);

      // Wait for Backend to become healthy
      await this.waitForHealth();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[ConnectionManager] Failed to start Backend: ${message}`);
      this.setState('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private async waitForHealth(): Promise<void> {
    const startTime = Date.now();
    const timeout = this.config.startupTimeout;

    this.setState('CONNECTING');

    const poll = async (): Promise<void> => {
      if (Date.now() - startTime > timeout) {
        this.outputChannel.appendLine('[ConnectionManager] Backend startup timeout');
        this.setState('DISCONNECTED');
        return;
      }

      try {
        const health = await this.httpClient.healthCheck();
        this.handleHealthSuccess(health as HealthResponse);
      } catch {
        // Not ready yet, retry in 500ms
        await new Promise(resolve => setTimeout(resolve, 500));
        await poll();
      }
    };

    await poll();
  }

  private handleHealthSuccess(health: HealthResponse): void {
    this.state.backendVersion = health.version;
    this.state.lastHealthCheck = Date.now();
    this.state.reconnectAttempts = 0;
    this.state.reconnectDelay = 1000;

    if (this.state.state !== 'CONNECTED') {
      this.state.connectedAt = Date.now();
    }

    this.setState('CONNECTED');
    this.startHealthPolling();
  }

  private startHealthPolling(): void {
    this.stopHealthPolling();
    this.healthTimer = setInterval(async () => {
      try {
        const health = await this.httpClient.healthCheck();
        this.state.lastHealthCheck = Date.now();
        this.state.backendVersion = (health as HealthResponse).version;
      } catch {
        this.outputChannel.appendLine('[ConnectionManager] Health check failed');
        this.setState('DISCONNECTED');
        this.stopHealthPolling();
        this.scheduleReconnect();
      }
    }, this.config.healthCheckInterval);
  }

  private stopHealthPolling(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(this.state.reconnectDelay, 30000);
    this.outputChannel.appendLine(`[ConnectionManager] Reconnecting in ${delay}ms...`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.state.reconnectAttempts++;
      this.state.reconnectDelay = Math.min(delay * 2, 30000); // Exponential backoff, max 30s
      await this.connect();
    }, delay);
  }

  disconnect(): void {
    this.stopHealthPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.backendProcess) {
      this.backendProcess.kill();
      this.backendProcess = null;
    }
    this.setState('DISCONNECTED');
  }

  private setState(newState: ConnectionStateType): void {
    const oldState = this.state.state;
    if (oldState === newState) return;

    this.state.state = newState;
    this.outputChannel.appendLine(`[ConnectionManager] State: ${oldState} -> ${newState}`);

    for (const listener of this.stateListeners) {
      try { listener({ ...this.state }); } catch { /* ignore listener errors */ }
    }
  }

  dispose(): void {
    this.disconnect();
  }
}
