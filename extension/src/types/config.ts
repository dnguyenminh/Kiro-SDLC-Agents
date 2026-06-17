/**
 * Extension type definitions — configuration.
 */

export interface BackendConfiguration {
  port: number;
  host: string;
  path: string;
  autoStart: boolean;
  healthCheckInterval: number;
  startupTimeout: number;
  compatRange: string;
}

export const DEFAULT_CONFIG: BackendConfiguration = {
  port: 48721,
  host: '127.0.0.1',
  path: '',
  autoStart: true,
  healthCheckInterval: 5000,
  startupTimeout: 30000,
  compatRange: '^1.0.0',
};
