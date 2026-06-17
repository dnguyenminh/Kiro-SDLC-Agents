/**
 * Extension type definitions — connection state machine.
 */

export type ConnectionStateType = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'STARTING';

export interface ConnectionState {
  state: ConnectionStateType;
  backendVersion: string | null;
  lastHealthCheck: number;
  reconnectAttempts: number;
  reconnectDelay: number;
  backendPid: number | null;
  connectedAt: number | null;
}

export interface HealthResponse {
  status: 'healthy' | 'starting';
  version: string;
  uptime: number;
  tools_loaded: number;
  modules: Record<string, string>;
}

export const DEFAULT_CONNECTION_STATE: ConnectionState = {
  state: 'DISCONNECTED',
  backendVersion: null,
  lastHealthCheck: 0,
  reconnectAttempts: 0,
  reconnectDelay: 1000,
  backendPid: null,
  connectedAt: null,
};
