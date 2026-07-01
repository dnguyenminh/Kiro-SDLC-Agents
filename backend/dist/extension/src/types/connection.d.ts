/**
 * Connection state types for Extension ↔ Remote Backend communication.
 * KSA-292: Removed STARTING state and process-related fields.
 * Implements TDD §4.1 ConnectionState.
 */
export type ConnectionStateValue = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
export interface ConnectionState {
    state: ConnectionStateValue;
    backendVersion: string | null;
    lastHealthCheck: number;
    reconnectAttempts: number;
    reconnectDelay: number;
    connectedAt: number | null;
}
export interface HealthResponse {
    status: 'healthy' | 'starting' | 'unhealthy';
    version: string;
    uptime: number;
    tools_loaded: number;
    modules: Record<string, 'initializing' | 'ready' | 'error'>;
}
export interface ConnectionConfig {
    url: string;
    healthCheckInterval: number;
    maxReconnectAttempts: number;
    initialReconnectDelay: number;
    maxReconnectDelay: number;
}
export declare const DEFAULT_CONNECTION_CONFIG: ConnectionConfig;
export declare function createInitialState(): ConnectionState;
