/**
 * Connection state types for Extension ↔ Remote Backend communication.
 * KSA-292: Removed STARTING state and process-related fields.
 * Implements TDD §4.1 ConnectionState.
 */
export const DEFAULT_CONNECTION_CONFIG = {
    url: 'http://127.0.0.1:48721',
    healthCheckInterval: 5000,
    maxReconnectAttempts: 100,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
};
export function createInitialState() {
    return {
        state: 'DISCONNECTED',
        backendVersion: null,
        lastHealthCheck: 0,
        reconnectAttempts: 0,
        reconnectDelay: DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
        connectedAt: null,
    };
}
//# sourceMappingURL=connection.js.map