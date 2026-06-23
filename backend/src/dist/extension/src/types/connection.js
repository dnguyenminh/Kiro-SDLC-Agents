"use strict";
/**
 * Connection state types for Extension ↔ Backend communication.
 * Implements TDD §4.1 ConnectionState and §5.5 State Machine.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONNECTION_CONFIG = void 0;
exports.createInitialState = createInitialState;
exports.DEFAULT_CONNECTION_CONFIG = {
    host: '127.0.0.1',
    port: 48721,
    healthCheckInterval: 5000,
    startupTimeout: 30000,
    maxReconnectAttempts: 100,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
};
function createInitialState() {
    return {
        state: 'DISCONNECTED',
        backendVersion: null,
        lastHealthCheck: 0,
        reconnectAttempts: 0,
        reconnectDelay: exports.DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
        backendPid: null,
        connectedAt: null,
    };
}
//# sourceMappingURL=connection.js.map