/**
 * ConnectionManager — manages Remote Backend connection lifecycle.
 * KSA-292: Removed BackendProcess dependency, URL-based, no STARTING state.
 * Implements TDD §4.1 ConnectionManager.
 */
import * as vscode from 'vscode';
import { DEFAULT_CONNECTION_CONFIG, createInitialState, } from '../types/connection';
import { HttpClient } from '../proxy/HttpClient';
import { HealthChecker } from './HealthChecker';
export class ConnectionManager {
    _state;
    stateChangeEmitter = new vscode.EventEmitter();
    healthChecker;
    client;
    reconnectTimer = null;
    outputChannel;
    get state() {
        return { ...this._state };
    }
    constructor(config, authManager, outputChannel) {
        this.outputChannel = outputChannel;
        this._state = createInitialState();
        this.client = new HttpClient({
            baseUrl: config.url,
            authManager,
            healthTimeout: 3000,
            toolCallTimeout: config.toolCallTimeout,
            webviewTimeout: 10000,
            chatTimeout: config.chatTimeout,
        });
        const connConfig = {
            url: config.url,
            healthCheckInterval: config.healthCheckInterval,
            maxReconnectAttempts: DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts,
            initialReconnectDelay: DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
            maxReconnectDelay: DEFAULT_CONNECTION_CONFIG.maxReconnectDelay,
        };
        this.healthChecker = new HealthChecker(this.client, connConfig);
    }
    async connect() {
        this.transitionTo('CONNECTING');
        const result = await this.healthChecker.checkOnce();
        if (result.success) {
            this.handleHealthSuccess(result.response);
            this.startHealthPolling();
        }
        else {
            this.transitionTo('DISCONNECTED');
            this.scheduleReconnect();
        }
    }
    disconnect() {
        this.healthChecker.stopPolling();
        this.cancelReconnect();
        this.transitionTo('DISCONNECTED');
        this._state.reconnectAttempts = 0;
        this._state.reconnectDelay = DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
    }
    onStateChange(listener) {
        return this.stateChangeEmitter.event(listener);
    }
    getHttpClient() {
        return this.client;
    }
    isConnected() {
        return this._state.state === 'CONNECTED';
    }
    dispose() {
        this.disconnect();
        this.healthChecker.dispose();
        this.stateChangeEmitter.dispose();
    }
    startHealthPolling() {
        this.healthChecker.startPolling((result) => {
            if (result.success) {
                this._state.lastHealthCheck = Date.now();
                if (this._state.state !== 'CONNECTED') {
                    this.handleHealthSuccess(result.response);
                }
            }
            else {
                if (this._state.state === 'CONNECTED') {
                    this.log('Health check failed - Backend disconnected');
                    this.transitionTo('DISCONNECTED');
                    this.healthChecker.stopPolling();
                    this.scheduleReconnect();
                }
            }
        });
    }
    handleHealthSuccess(response) {
        this._state.backendVersion = response.version;
        this._state.lastHealthCheck = Date.now();
        this._state.connectedAt = this._state.connectedAt ?? Date.now();
        this._state.reconnectAttempts = 0;
        this._state.reconnectDelay = DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
        this.transitionTo('CONNECTED');
        this.log('Connected to Backend v' + response.version + ' (' + response.tools_loaded + ' tools)');
    }
    scheduleReconnect() {
        if (this._state.reconnectAttempts >= DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts) {
            this.log('Max reconnect attempts reached');
            return;
        }
        this.cancelReconnect();
        const delay = this._state.reconnectDelay;
        this.reconnectTimer = setTimeout(async () => {
            this._state.reconnectAttempts++;
            this._state.reconnectDelay = Math.min(this._state.reconnectDelay * 2, DEFAULT_CONNECTION_CONFIG.maxReconnectDelay);
            this.transitionTo('CONNECTING');
            const result = await this.healthChecker.checkOnce();
            if (result.success) {
                this.handleHealthSuccess(result.response);
                this.startHealthPolling();
            }
            else {
                this.transitionTo('DISCONNECTED');
                this.scheduleReconnect();
            }
        }, delay);
    }
    cancelReconnect() {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    transitionTo(newState) {
        if (this._state.state === newState)
            return;
        const oldState = this._state.state;
        this._state.state = newState;
        if (newState === 'DISCONNECTED') {
            this._state.connectedAt = null;
        }
        this.log('State: ' + oldState + ' -> ' + newState);
        this.stateChangeEmitter.fire({ ...this._state });
    }
    log(message) {
        this.outputChannel.appendLine('[ConnectionManager] ' + message);
    }
}
//# sourceMappingURL=ConnectionManager.js.map