/**
 * Connection state types for Extension ↔ Backend communication.
 * Implements TDD §4.1 ConnectionState and §5.5 State Machine.
 */

export type ConnectionStateValue = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'STARTING';

export interface ConnectionState {
  state: ConnectionStateValue;
  backendVersion: string | null;
  lastHealthCheck: number;
  reconnectAttempts: number;
  reconnectDelay: number;
  backendPid: number | null;
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
  host: string;
  port: number;
  healthCheckInterval: number;
  startupTimeout: number;
  maxReconnectAttempts: number;
  initialReconnectDelay: number;
  maxReconnectDelay: number;
}

export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  host: '127.0.0.1',
  port: 48721,
  healthCheckInterval: 5000,
  startupTimeout: 30000,
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
    backendPid: null,
    connectedAt: null,
  };
}
