/**
 * ConnectionManager — manages Backend connection lifecycle.
 * Implements TDD §5.3 IConnectionManager and §5.5 State Machine.
 */

import * as vscode from 'vscode';
import {
  ConnectionState,
  ConnectionStateValue,
  ConnectionConfig,
  DEFAULT_CONNECTION_CONFIG,
  createInitialState,
  HealthResponse,
} from '../types/connection';
import { BackendConfiguration } from '../types/config';
import { HttpClient } from '../proxy/HttpClient';
import { HealthChecker } from './HealthChecker';
import { BackendProcess } from './BackendProcess';

export interface IConnectionManager {
  readonly state: ConnectionState;
  connect(): Promise<void>;
  disconnect(): void;
  onStateChange(listener: (state: ConnectionState) => void): vscode.Disposable;
}

export class ConnectionManager implements IConnectionManager, vscode.Disposable {
  private _state: ConnectionState;
  private readonly stateChangeEmitter = new vscode.EventEmitter<ConnectionState>();
  private readonly healthChecker: HealthChecker;
  private readonly backendProcess: BackendProcess;
  private readonly client: HttpClient;
  private readonly config: BackendConfiguration;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly outputChannel: vscode.OutputChannel;

  get state(): ConnectionState {
    return { ...this._state };
  }

  constructor(config: BackendConfiguration, outputChannel: vscode.OutputChannel) {
    this.config = config;
    this.outputChannel = outputChannel;
    this._state = createInitialState();

    const baseUrl = 'http://' + config.host + ':' + config.port;
    this.client = new HttpClient({
      baseUrl,
      healthTimeout: 3000,
      toolCallTimeout: 300000,
      webviewTimeout: 10000,
    });

    const connConfig: ConnectionConfig = {
      host: config.host,
      port: config.port,
      healthCheckInterval: config.healthCheckInterval,
      startupTimeout: config.startupTimeout,
      maxReconnectAttempts: DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts,
      initialReconnectDelay: DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
      maxReconnectDelay: DEFAULT_CONNECTION_CONFIG.maxReconnectDelay,
    };

    this.healthChecker = new HealthChecker(this.client, connConfig);
    this.backendProcess = new BackendProcess();

    this.backendProcess.on('exit', () => {
      this.log('Backend process exited');
      this.transitionTo('DISCONNECTED');
      this.scheduleReconnect();
    });

    this.backendProcess.on('error', (error: Error) => {
      this.log('Backend process error: ' + error.message);
    });
  }

  async connect(): Promise<void> {
    this.transitionTo('CONNECTING');

    const result = await this.healthChecker.checkOnce();
    if (result.success) {
      this.handleHealthSuccess(result.response);
      this.startHealthPolling();
      return;
    }

    if (this.config.autoStart && this.config.backendPath) {
      this.transitionTo('STARTING');
      this.backendProcess.spawn({
        backendPath: this.config.backendPath,
        port: this.config.port,
        host: this.config.host,
      });
      this._state.backendPid = this.backendProcess.pid;
      await this.waitForHealthy();
    } else {
      this.transitionTo('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.healthChecker.stopPolling();
    this.cancelReconnect();
    this.backendProcess.kill();
    this.transitionTo('DISCONNECTED');
    this._state.reconnectAttempts = 0;
    this._state.reconnectDelay = DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
  }

  onStateChange(listener: (state: ConnectionState) => void): vscode.Disposable {
    return this.stateChangeEmitter.event(listener);
  }

  getHttpClient(): HttpClient {
    return this.client;
  }

  isConnected(): boolean {
    return this._state.state === 'CONNECTED';
  }

  dispose(): void {
    this.disconnect();
    this.healthChecker.dispose();
    this.backendProcess.dispose();
    this.stateChangeEmitter.dispose();
  }

  private async waitForHealthy(): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < this.config.startupTimeout) {
      const result = await this.healthChecker.checkOnce();
      if (result.success && result.response.status === 'healthy') {
        this.handleHealthSuccess(result.response);
        this.startHealthPolling();
        return;
      }
      await this.sleep(pollInterval);
    }

    this.log('Backend startup timeout');
    this.transitionTo('DISCONNECTED');
    this.scheduleReconnect();
  }

  private startHealthPolling(): void {
    this.healthChecker.startPolling((result) => {
      if (result.success) {
        this._state.lastHealthCheck = Date.now();
        if (this._state.state !== 'CONNECTED') {
          this.handleHealthSuccess(result.response);
        }
      } else {
        if (this._state.state === 'CONNECTED') {
          this.log('Health check failed - Backend disconnected');
          this.transitionTo('DISCONNECTED');
          this.healthChecker.stopPolling();
          this.scheduleReconnect();
        }
      }
    });
  }

  private handleHealthSuccess(response: HealthResponse): void {
    this._state.backendVersion = response.version;
    this._state.lastHealthCheck = Date.now();
    this._state.connectedAt = this._state.connectedAt ?? Date.now();
    this._state.reconnectAttempts = 0;
    this._state.reconnectDelay = DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
    this.transitionTo('CONNECTED');
    this.log('Connected to Backend v' + response.version + ' (' + response.tools_loaded + ' tools)');
  }

  private scheduleReconnect(): void {
    if (this._state.reconnectAttempts >= DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      return;
    }

    this.cancelReconnect();
    const delay = this._state.reconnectDelay;

    this.reconnectTimer = setTimeout(async () => {
      this._state.reconnectAttempts++;
      this._state.reconnectDelay = Math.min(
        this._state.reconnectDelay * 2,
        DEFAULT_CONNECTION_CONFIG.maxReconnectDelay
      );
      this.transitionTo('CONNECTING');

      const result = await this.healthChecker.checkOnce();
      if (result.success) {
        this.handleHealthSuccess(result.response);
        this.startHealthPolling();
      } else {
        this.transitionTo('DISCONNECTED');
        this.scheduleReconnect();
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private transitionTo(newState: ConnectionStateValue): void {
    if (this._state.state === newState) return;
    const oldState = this._state.state;
    this._state.state = newState;
    if (newState === 'DISCONNECTED') {
      this._state.connectedAt = null;
    }
    this.log('State: ' + oldState + ' -> ' + newState);
    this.stateChangeEmitter.fire({ ...this._state });
  }

  private log(message: string): void {
    this.outputChannel.appendLine('[ConnectionManager] ' + message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
