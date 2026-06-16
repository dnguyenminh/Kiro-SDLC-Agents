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

export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  url: 'http://127.0.0.1:48721',
  healthCheckInterval: 5000,
  maxReconnectAttempts: 100,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
};

export function createInitialState(): ConnectionState {
  return {
    state: 'DISCONNECTED',
    backendVersion: null,
    lastHealthCheck: 0,
    reconnectAttempts: 0,
    reconnectDelay: DEFAULT_CONNECTION_CONFIG.initialReconnectDelay,
    connectedAt: null,
  };
}
