"use strict";
/**
 * ConnectionManager — Backend connectivity state machine.
 * States: DISCONNECTED → CONNECTING → CONNECTED
 * Auto-reconnects with exponential backoff.
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
const HealthChecker_1 = require("./HealthChecker");
class ConnectionManager {
    config;
    authManager;
    httpClient;
    state = "DISCONNECTED";
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelays = [1000, 2000, 4000, 8000, 16000];
    reconnectTimer = null;
    healthChecker;
    _onStateChange = new vscode.EventEmitter();
    onStateChange = this._onStateChange.event;
    constructor(config, authManager, httpClient) {
        this.config = config;
        this.authManager = authManager;
        this.httpClient = httpClient;
        this.healthChecker = new HealthChecker_1.HealthChecker(httpClient, config.healthCheckInterval);
        this.healthChecker.onHealthFail(() => {
            if (this.state === "CONNECTED") {
                this.transitionTo("DISCONNECTED");
                this.scheduleReconnect();
            }
        });
    }
    get currentState() {
        return this.state;
    }
    get isConnected() {
        return this.state === "CONNECTED";
    }
    get backendUrl() {
        return this.config.url;
    }
    /**
     * Attempt to connect to backend.
     */
    async connect() {
        this.transitionTo("CONNECTING");
        const healthy = await this.httpClient.healthCheck();
        if (healthy) {
            this.transitionTo("CONNECTED");
            this.reconnectAttempts = 0;
            this.healthChecker.start();
        }
        else {
            this.transitionTo("DISCONNECTED");
            this.scheduleReconnect();
        }
    }
    /**
     * Disconnect and stop health checking.
     */
    disconnect() {
        this.healthChecker.stop();
        this.cancelReconnect();
        this.transitionTo("DISCONNECTED");
    }
    /**
     * Update backend URL (e.g., settings changed).
     */
    updateConfig(newConfig) {
        if (newConfig.url) {
            this.config.url = newConfig.url;
            this.httpClient.baseUrl = newConfig.url;
        }
        if (newConfig.healthCheckInterval) {
            this.config.healthCheckInterval = newConfig.healthCheckInterval;
            this.healthChecker.interval = newConfig.healthCheckInterval;
        }
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            vscode.window.showErrorMessage("Cannot connect to Kiro backend. Check backend URL in settings.");
            return;
        }
        const delay = this.reconnectDelays[this.reconnectAttempts] || 16000;
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }
    cancelReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
    }
    transitionTo(newState) {
        if (this.state === newState) {
            return;
        }
        this.state = newState;
        this._onStateChange.fire(newState);
    }
    dispose() {
        this.healthChecker.stop();
        this.cancelReconnect();
        this._onStateChange.dispose();
    }
}
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=ConnectionManager.js.map