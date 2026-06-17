"use strict";
/**
 * ConnectionManager — manages Backend connection lifecycle.
 * Implements TDD §5.3 IConnectionManager and §5.5 State Machine.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const vscode = __importStar(require("vscode"));
const connection_1 = require("../types/connection");
const HttpClient_1 = require("../proxy/HttpClient");
const HealthChecker_1 = require("./HealthChecker");
const BackendProcess_1 = require("./BackendProcess");
class ConnectionManager {
    _state;
    stateChangeEmitter = new vscode.EventEmitter();
    healthChecker;
    backendProcess;
    client;
    config;
    reconnectTimer = null;
    outputChannel;
    get state() {
        return { ...this._state };
    }
    constructor(config, outputChannel) {
        this.config = config;
        this.outputChannel = outputChannel;
        this._state = (0, connection_1.createInitialState)();
        const baseUrl = 'http://' + config.host + ':' + config.port;
        this.client = new HttpClient_1.HttpClient({
            baseUrl,
            healthTimeout: 3000,
            toolCallTimeout: 300000,
            webviewTimeout: 10000,
        });
        const connConfig = {
            host: config.host,
            port: config.port,
            healthCheckInterval: config.healthCheckInterval,
            startupTimeout: config.startupTimeout,
            maxReconnectAttempts: connection_1.DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts,
            initialReconnectDelay: connection_1.DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
            maxReconnectDelay: connection_1.DEFAULT_CONNECTION_CONFIG.maxReconnectDelay,
        };
        this.healthChecker = new HealthChecker_1.HealthChecker(this.client, connConfig);
        this.backendProcess = new BackendProcess_1.BackendProcess();
        this.backendProcess.on('exit', () => {
            this.log('Backend process exited');
            this.transitionTo('DISCONNECTED');
            this.scheduleReconnect();
        });
        this.backendProcess.on('error', (error) => {
            this.log('Backend process error: ' + error.message);
        });
    }
    async connect() {
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
        }
        else {
            this.transitionTo('DISCONNECTED');
            this.scheduleReconnect();
        }
    }
    disconnect() {
        this.healthChecker.stopPolling();
        this.cancelReconnect();
        this.backendProcess.kill();
        this.transitionTo('DISCONNECTED');
        this._state.reconnectAttempts = 0;
        this._state.reconnectDelay = connection_1.DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
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
        this.backendProcess.dispose();
        this.stateChangeEmitter.dispose();
    }
    async waitForHealthy() {
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
        this._state.reconnectDelay = connection_1.DEFAULT_CONNECTION_CONFIG.initialReconnectDelay;
        this.transitionTo('CONNECTED');
        this.log('Connected to Backend v' + response.version + ' (' + response.tools_loaded + ' tools)');
    }
    scheduleReconnect() {
        if (this._state.reconnectAttempts >= connection_1.DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts) {
            this.log('Max reconnect attempts reached');
            return;
        }
        this.cancelReconnect();
        const delay = this._state.reconnectDelay;
        this.reconnectTimer = setTimeout(async () => {
            this._state.reconnectAttempts++;
            this._state.reconnectDelay = Math.min(this._state.reconnectDelay * 2, connection_1.DEFAULT_CONNECTION_CONFIG.maxReconnectDelay);
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
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=ConnectionManager.js.map